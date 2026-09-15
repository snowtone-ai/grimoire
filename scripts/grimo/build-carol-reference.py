"""Carol: reference-space sculpture, closed volumes, projection UVs and facial morphs.

Run with Blender --background --factory-startup --python scripts/grimo/build-carol-reference.py.
All measurements below use the ORIGINAL 624 x 400 image, not a resized AI description.
The source is embedded, never edited. Back/occluded surfaces are authored reconstructions.
"""
import bpy
import bmesh
import math
import json
import hashlib
from collections import deque
from pathlib import Path

import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/grimo/source/carol-transparent.png'
OUT = ROOT / 'public/grimo/carol-3d'
WORK = ROOT / 'output/playwright/carol-rebuild'
OUT.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
SCALE = .007
ORIGIN = (337, 394)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
art = bpy.data.images.load(str(SOURCE), check_existing=True)
W, H = art.size
assert (W, H) == (624, 400), 'Landmarks require the unchanged source dimensions'
pixels = np.asarray(art.pixels[:], dtype=np.float32).reshape(H, W, 4)[::-1].copy()
art.pack()
yy, xx = np.mgrid[0:H, 0:W]


def point(x, y, depth=0):
    return Vector(((x - ORIGIN[0]) * SCALE, -depth, (ORIGIN[1] - y) * SCALE))


def parent_keep(obj, parent):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world
    return obj


def pivot(name, xy, depth, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = point(*xy, depth)
    return parent_keep(obj, parent) if parent else obj


def linear(rgb):
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)


def paint_material(name, textured=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    if textured:
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = art
        tex.interpolation = 'Linear'
        transparent = nodes.new('ShaderNodeBsdfTransparent')
        mix = nodes.new('ShaderNodeMixShader')
        links.new(tex.outputs['Alpha'], mix.inputs[0])
        links.new(transparent.outputs[0], mix.inputs[1])
        links.new(tex.outputs['Color'], mix.inputs[2])
        links.new(mix.outputs[0], output.inputs['Surface'])
        mat.surface_render_method = 'DITHERED'
    else:
        attr = nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'Paint'
        # A color socket directly into Surface is the glTF exporter's supported
        # KHR_materials_unlit pattern. Emission alone exports a white emissive
        # factor and cannot carry the reverse's painted vertex colors.
        links.new(attr.outputs['Color'], output.inputs['Surface'])
    return mat


projection = paint_material('Carol • original watercolor / projection UV', True)
reconstructed = paint_material('Carol • painted reverse / reconstructed', False)


def polygon_mask(points):
    inside = np.zeros((H, W), dtype=bool)
    for (x1, y1), (x2, y2) in zip(points, points[1:] + points[:1]):
        if y1 == y2:
            continue
        inside ^= ((y1 > yy) != (y2 > yy)) & (xx < (x2-x1)*(yy-y1)/(y2-y1)+x1)
    return inside


def rounded_trace(points):
    result = []
    for i,p1 in enumerate(points):
        p0,p2,p3 = points[(i-1)%len(points)],points[(i+1)%len(points)],points[(i+2)%len(points)]
        for step in range(6):
            t = step/6
            result.append(tuple(.5*((2*p1[d])+(-p0[d]+p2[d])*t+
                (2*p0[d]-5*p1[d]+4*p2[d]-p3[d])*t*t+
                (-p0[d]+3*p1[d]-3*p2[d]+p3[d])*t*t*t) for d in (0,1)))
    return result


def largest_component(mask):
    visited = np.zeros_like(mask)
    largest = []
    for y, x in zip(*np.where(mask)):
        if visited[y, x]:
            continue
        todo, component = deque([(x, y)]), []
        visited[y, x] = True
        while todo:
            px, py = todo.popleft()
            component.append((px, py))
            for nx, ny in ((px-1, py), (px+1, py), (px, py-1), (px, py+1)):
                if 0 <= nx < W and 0 <= ny < H and mask[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = True
                    todo.append((nx, ny))
        if len(component) > len(largest):
            largest = component
    result = np.zeros_like(mask)
    for x, y in largest:
        result[y, x] = True
    return result


# Traces follow the anatomical overlaps, not a symmetric generic sheep template.
HEAD = [(254, 213), (259, 190), (266, 165), (285, 149), (291, 121),
        (315, 99), (343, 82), (374, 73), (403, 83), (428, 67), (457, 76),
        (470, 99), (494, 109), (503, 132), (520, 142), (529, 164),
        (520, 193), (526, 219), (523, 250), (505, 268), (501, 292),
        (478, 317), (451, 334), (416, 338), (390, 329), (367, 337),
        (342, 323), (319, 321), (298, 306), (293, 280), (306, 254),
        (296, 237), (272, 240)]
FACE = [(337, 242), (344, 225), (359, 213), (369, 197), (392, 187),
        (411, 176), (435, 181), (458, 175), (483, 184), (500, 205),
        (512, 230), (504, 251), (485, 269), (458, 283), (429, 295),
        (402, 302), (378, 299), (355, 287), (343, 270)]
EAR_L = [(299, 235), (313, 246), (301, 267), (285, 286), (262, 296),
         (241, 294), (229, 287), (232, 275), (249, 258), (273, 242)]
EAR_R = [(513, 166), (533, 169), (555, 170), (571, 177), (573, 188),
         (560, 205), (542, 218), (524, 218), (515, 202)]
LEGS = {
    'LegLBack': [(204, 341), (232, 345), (253, 352), (258, 366), (249, 384),
                 (239, 387), (224, 379), (213, 365)],
    'LegLFront': [(324, 352), (361, 352), (384, 363), (387, 380), (378, 392),
                  (364, 397), (344, 390), (332, 376)],
    'LegRFront': [(425, 333), (465, 333), (474, 347), (469, 365), (459, 379),
                  (445, 380), (433, 368)],
}
head_mask = polygon_mask(rounded_trace(HEAD))
face_mask = polygon_mask(rounded_trace(FACE))
ear_masks = [polygon_mask(rounded_trace(EAR_L)), polygon_mask(rounded_trace(EAR_R))]
leg_masks = [polygon_mask(rounded_trace(p)) for p in LEGS.values()]
body_mask = largest_component(pixels[:, :, 3] > .35)
BODY_OUTLINE = [(236, 52), (244, 30), (270, 13), (296, 10), (320, 26),
                (340, 22), (356, 8), (379, 8), (398, 23), (406, 46),
                (428, 52), (439, 72), (461, 77), (475, 99), (500, 109),
                (519, 131), (531, 157), (519, 177), (529, 211),
                (539, 239), (529, 266), (515, 284), (508, 307),
                (485, 327), (468, 345), (444, 359), (411, 368),
                (390, 372), (360, 368), (331, 366), (307, 380),
                (284, 380), (263, 368), (242, 357), (218, 348),
                (192, 333), (168, 323), (148, 313), (130, 300),
                (115, 288), (115, 272), (124, 249), (113, 235),
                (99, 236), (93, 223), (101, 207), (113, 197),
                (117, 177), (130, 157), (148, 148), (163, 151),
                (165, 130), (181, 112), (201, 100), (204, 82), (218, 63)]
body_mask &= polygon_mask(rounded_trace(BODY_OUTLINE))
# The hooves are part of Carol's illustrated silhouette.  They must remain on
# the body sheet rather than be animated as detached limbs: the reference is a
# single, tucked-in creature, not a four-legged walking rig.
body_mask |= np.logical_or.reduce(leg_masks)
body_mask &= pixels[:, :, 3] > .12

# (x, y, horizontal radius, vertical radius, raised depth). Broad, medium and
# small locks retain directional rhythm; their ridges are not smoothed away.
BODY_LOCKS = [
    (289, 45, 53, 34, .28), (361, 35, 39, 27, .23), (320, 62, 57, 40, .25),
    (229, 83, 30, 31, .19), (260, 113, 42, 30, .22), (201, 133, 42, 29, .23),
    (154, 178, 31, 31, .20), (132, 215, 37, 24, .21), (173, 212, 31, 32, .24),
    (186, 248, 39, 33, .27), (144, 272, 30, 36, .21), (168, 302, 37, 28, .26),
    (211, 323, 39, 27, .21), (248, 341, 34, 23, .19), (285, 352, 31, 22, .20),
    (337, 342, 40, 27, .24), (393, 343, 34, 25, .23), (452, 326, 33, 27, .20),
    (492, 293, 31, 30, .25), (520, 247, 28, 29, .24), (519, 153, 25, 26, .21),
    (452, 102, 32, 30, .22), (402, 62, 29, 25, .20), (222, 187, 53, 56, .18),
    (263, 258, 47, 35, .24), (234, 291, 32, 24, .22), (300, 299, 26, 25, .20),
]
HEAD_LOCKS = [
    (286, 215, 28, 24, .22), (290, 175, 24, 25, .24), (319, 156, 28, 23, .24),
    (320, 122, 29, 26, .25), (355, 119, 34, 30, .25), (385, 100, 35, 27, .23),
    (425, 95, 33, 25, .23), (456, 118, 35, 27, .26), (480, 140, 30, 27, .25),
    (500, 160, 24, 28, .22), (406, 148, 39, 32, .26), (366, 165, 30, 27, .26),
    (337, 191, 32, 23, .23), (324, 222, 25, 24, .24), (326, 267, 23, 29, .24),
    (333, 295, 25, 22, .22), (365, 316, 29, 22, .24), (407, 317, 27, 23, .20),
    (453, 306, 28, 25, .21), (490, 279, 20, 23, .20), (518, 234, 16, 24, .16),
]


def locks_depth(x, y, locks):
    # Smooth maximum keeps individual broad ridges without ball intersections.
    values = [depth * math.exp(-2.0 * (((x-cx)/rx)**2 + ((y-cy)/ry)**2))
              for cx, cy, rx, ry, depth in locks]
    return (sum(value**5 for value in values)) ** .2


def body_front(x, y, r):
    return .02 + .67 * math.sqrt(max(0, 1-r*r)) + locks_depth(x, y, BODY_LOCKS)


def head_front(x, y, r):
    base = .68 + .39 * math.sqrt(max(0, 1-r*r))
    # Recess the face, so the fringe and cheek ruff sit around it in actual depth.
    recess = .17 * math.exp(-(((x-426)/70)**4 + ((y-242)/58)**4))
    return base + locks_depth(x, y, HEAD_LOCKS) - recess


def face_front(x, y, r):
    return 1.025 + .24 * math.sqrt(max(0, 1-r*r))


def back_paint(x, y, depth, normal_z, kind):
    if kind == 'ear':
        palette = ((.40, .27, .25), (.61, .44, .39), (.80, .57, .51))
    elif kind == 'hoof':
        palette = ((.39, .31, .29), (.53, .42, .39), (.63, .51, .46))
    elif kind == 'gold':
        palette = ((.90, .66, .32), (1, .85, .48), (1, .95, .66))
    elif kind == 'skin':
        palette = ((1, .86, .78), (1, .93, .83), (1, .96, .87))
    elif kind == 'cloud':
        palette = ((.82, .89, .98), (.93, .97, 1.), (1., .99, .97))
    elif kind == 'tailcloud':
        palette = ((.90, .72, .82), (.99, .86, .91), (1., .96, .94))
    else:
        palette = ((.57, .67, .94), (.78, .76, .98), (1, .96, .85))
    wave = .5 + .26 * math.sin(x*.035+y*.027) + .15*math.sin(x*.061-y*.045)
    warmth = max(0, min(1, (240-y)/185)) if kind == 'wool' else .46
    cold = tuple(palette[0][i]*(1-wave) + palette[1][i]*wave for i in range(3))
    col = tuple(cold[i]*(1-warmth) + palette[2][i]*warmth for i in range(3))
    brush = .98 + .015*math.sin(x*.55+y*.16)*math.sin(y*.31) + .009*math.sin(x*1.3-y*.6)
    # Baked broad, lavender-tinted soft shading, not metallic PBR highlights.
    light = .91 + .09*max(0, normal_z)
    return (*linear(tuple(min(1, c*brush*light) for c in col)), 1)


def sample_mask(mask, x, y):
    return 0 <= int(x) < W and 0 <= int(y) < H and bool(mask[int(y), int(x)])


def volume_paint(name, center, radii, kind, hide_regions):
    """Opaque UV paint for a whole volume; source alpha only blends pigment.

    This atlas is derived production texture, never an edit of the source.
    Spherical UVs keep the reconstructed side from stretching projected pixels.
    """
    size = 1024 if name == 'Face' else 512 if kind == 'wool' else 256
    ty, tx = np.mgrid[0:size, 0:size]
    angle = (tx+.5)/size*math.tau
    theta = (1-(ty+.5)/size)*math.pi
    r = np.sin(theta)
    ca, sa = np.cos(angle), np.sin(angle)
    count = len(radii)
    radius = np.interp(angle/math.tau*count, np.arange(count+1), radii+[radii[0]])
    rx = (radii[0]+radii[count//2])/2
    ry = (radii[count//4]+radii[3*count//4])/2
    ellipse = 1/np.sqrt((ca/rx)**2+(sa/ry)**2)
    radius = ellipse+(radius-ellipse)*r**12
    x, y = center[0]+ca*radius*r, center[1]+sa*radius*r
    if kind == 'ear':
        palette = ((.40,.27,.25),(.61,.44,.39),(.80,.57,.51))
    elif kind == 'hoof':
        palette = ((.39,.31,.29),(.53,.42,.39),(.63,.51,.46))
    elif kind == 'gold':
        palette = ((.90,.66,.32),(1,.85,.48),(1,.95,.66))
    elif kind == 'skin':
        palette = ((1,.86,.78),(1,.93,.83),(1,.96,.87))
    elif kind == 'tail':
        palette = ((.70,.70,.91),(.87,.84,.98),(1,.95,.87))
    elif kind == 'cloud':
        palette = ((.82,.89,.98),(.93,.97,1.),(1.,.99,.97))
    elif kind == 'tailcloud':
        palette = ((.90,.72,.82),(.99,.86,.91),(1.,.96,.94))
    else:
        palette = ((.57,.67,.94),(.78,.76,.98),(1,.96,.85))
    wave = (.5+.26*np.sin(x*.035+y*.027)+.15*np.sin(x*.061-y*.045))[...,None]
    warmth = np.clip((240-y)/185,0,1)[...,None] if kind == 'wool' else .46
    base = (np.array(palette[0])*(1-wave)+np.array(palette[1])*wave)*(1-warmth)+np.array(palette[2])*warmth
    sample_x, sample_y = x, y
    # Reuse the lower-left atmosphere cloud's hand-painted source pixels on
    # the tail, translated to its attachment point.
    if kind == 'tailcloud':
        sample_x = x + 53
        sample_y = y + 136
    sample_x = np.clip(sample_x,0,W-1.001); sample_y = np.clip(sample_y,0,H-1.001)
    ix, iy = sample_x.astype(int), sample_y.astype(int)
    fx, fy = (sample_x-ix)[...,None], (sample_y-iy)[...,None]
    sample = (pixels[iy,ix]*(1-fx)+pixels[iy,ix+1]*fx)*(1-fy)+(pixels[iy+1,ix]*(1-fx)+pixels[iy+1,ix+1]*fx)*fy
    if kind == 'tailcloud':
        # Keep the borrowed cloud airy while making its new tail role legible
        # against Carol's blue-white fleece.
        sample[:,:,:3] = sample[:,:,:3]*.64 + np.array((1., .78, .87))* .36
    # Front-facing pigment fades before the rounded side; no transparent holes.
    weight = np.clip((np.cos(theta)-.08)/.35,0,1)
    weight = weight*weight*(3-2*weight)*sample[:,:,3]
    # The tail has no source pixels to inherit. Its own pale watercolor keeps
    # the new silhouette legible against Carol's blue rear fleece.
    if kind == 'tail':
        weight *= 0
    for region in hide_regions:
        weight *= ~region[iy,ix]
    rgba = np.ones((size,size,4),dtype=np.float32)
    rgba[:,:,:3] = base*(1-weight[...,None])+sample[:,:,:3]*weight[...,None]
    image = bpy.data.images.new(name+' • opaque volume paint',width=size,height=size,alpha=False)
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(WORK/(name+'-paint.png'))
    image.file_format = 'PNG'
    image.save(); image.pack()
    mat = bpy.data.materials.new(name+' • continuous opaque watercolor')
    mat.use_nodes = True
    mat.node_tree.nodes.clear()
    output = mat.node_tree.nodes.new('ShaderNodeOutputMaterial')
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image
    mat.node_tree.links.new(tex.outputs['Color'],output.inputs['Surface'])
    return mat


def surface(name, mask, center, parent, front, rear_depth=.5, kind='wool',
            rings=46, segments=192, hide_regions=()):
    """Closed radial volume. Front and back share a rounded silhouette seam.

    Projection UV is an authored texture on thousands of curved vertices. There
    are no camera-facing planes, sprites or view-switched impostors in Carol.
    """
    cx, cy = center
    radii = []
    for i in range(segments):
        a = i*math.tau/segments
        ca, sa = math.cos(a), math.sin(a)
        samples = np.arange(.5, 430, .5)
        sx, sy = (cx+ca*samples).astype(int), (cy+sa*samples).astype(int)
        valid = (sx >= 0) & (sx < W) & (sy >= 0) & (sy < H)
        hits = samples[valid][mask[sy[valid], sx[valid]]]
        last = float(hits[-1]) if len(hits) else 1.
        radii.append(last)
    # Subpixel smoothing removes raster stair-steps, retaining the traced tufts.
    radii = [.14*radii[(i-1)%segments]+.72*radii[i]+.14*radii[(i+1)%segments]
             for i in range(segments)]
    # The traced scallops belong to the silhouette, not to every latitude.
    # Fade to an ellipse inside the volume so tufts do not form radial flutes.
    rx = (radii[0] + radii[segments//2]) / 2
    ry = (radii[segments//4] + radii[3*segments//4]) / 2
    def ring_point(i, r):
        a = i*math.tau/segments
        ca, sa = math.cos(a), math.sin(a)
        ellipse = 1 / math.sqrt((ca/rx)**2 + (sa/ry)**2)
        radius = ellipse + (radii[i]-ellipse)*r**12
        return cx+ca*radius*r, cy+sa*radius*r
    rear_locks = []
    if kind == 'wool':
        for j in range(42):
            z = (j+.5)/42
            a = j*2.39996323
            spread = math.sqrt(1-z*z)
            rear_locks.append((math.cos(a)*spread,math.sin(a)*spread,z))
    tuft_scale = .14*min(1,min(rx,ry)/140)
    def rear_tuft(nx,ny,nz):
        return max((math.exp(-((nx-lx)**2+(ny-ly)**2+(nz-lz)**2)/.065)
                    for lx,ly,lz in rear_locks),default=0)*tuft_scale*nz
    verts, coords, faces, material_ids = [], [], [], []
    # Outer ring shared by both hemispheres; the reverse has its own center.
    verts.append(point(cx, cy, front(cx, cy, 0)))
    coords.append((cx, cy, 0, True))
    for ring in range(1, rings+1):
        r = math.sin(ring/rings*math.pi/2)
        for i, radius in enumerate(radii):
            a = i*math.tau/segments
            x, y = ring_point(i, r)
            verts.append(point(x, y, front(x, y, r)))
            coords.append((x, y, r, True))
    for i in range(segments):
        faces.append((0, 1+i, 1+(i+1)%segments)); material_ids.append(0)
    for ring in range(1, rings):
        for i in range(segments):
            a, b = 1+(ring-1)*segments+i, 1+(ring-1)*segments+(i+1)%segments
            faces.append((a, a+segments, b+segments, b)); material_ids.append(0)
    rear_center = len(verts)
    seam_depth = front(cx, cy, 1)
    verts.append(point(cx, cy, seam_depth-rear_depth-rear_tuft(0,0,1)))
    coords.append((cx, cy, 0, False))
    for ring in range(1, rings):
        r = math.sin(ring/rings*math.pi/2)
        for i, radius in enumerate(radii):
            a = i*math.tau/segments
            x, y = ring_point(i, r)
            seam = front(cx+math.cos(a)*radius, cy+math.sin(a)*radius, 1)
            nz = math.sqrt(max(0,1-r*r))
            nx, ny = math.cos(a)*r, math.sin(a)*r
            tuft = rear_tuft(nx,ny,nz)
            # A single centre depth: the angular seam must vanish at the pole.
            d = seam_depth+(seam-seam_depth)*r**12-rear_depth*nz-tuft*nz
            x += nx*tuft/SCALE; y += ny*tuft/SCALE
            verts.append(point(x, y, d))
            coords.append((x, y, r, False))
    for i in range(segments):
        faces.append((rear_center, rear_center+1+(i+1)%segments, rear_center+1+i)); material_ids.append(1)
    for ring in range(1, rings):
        for i in range(segments):
            a = rear_center+1+(ring-1)*segments+i
            b = rear_center+1+(ring-1)*segments+(i+1)%segments
            if ring == rings-1:
                c, d = 1+(rings-1)*segments+i, 1+(rings-1)*segments+(i+1)%segments
            else:
                c, d = a+segments, b+segments
            faces.append((a, b, d, c)); material_ids.append(1)
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(volume_paint(name, center, radii, kind, hide_regions))
    uv = mesh.uv_layers.new(name='VolumePaint')
    for poly, mat_id in zip(mesh.polygons, material_ids):
        poly.use_smooth = True
        us = [(math.atan2(coords[v][1]-cy,coords[v][0]-cx)/math.tau)%1 for v in poly.vertices]
        crosses_seam = max(us)-min(us) > .5
        for li in poly.loop_indices:
            x, y, r, is_front = coords[mesh.loops[li].vertex_index]
            u = (math.atan2(y-cy,x-cx)/math.tau)%1
            if crosses_seam and u < .5: u += 1
            theta = math.asin(min(1,r))
            if mat_id == 1: theta = math.pi-theta
            if r == 0:
                others = [value+(1 if crosses_seam and value < .5 else 0) for value in us]
                u = sum(others)/len(others)
            uv.data[li].uv = (u,1-theta/math.pi)
    # Recalculate consistently after constructing both hemispheres.
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh); bm.free()
    obj['reference_center'] = [cx, cy]
    obj['construction'] = 'closed curved volume with reference projection UV'
    parent_keep(obj, parent)
    return obj, coords


root = pivot('Carol', ORIGIN, 0)
root['source_sha256'] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
root['reference_size'] = [W, H]
root['reference_origin'] = list(ORIGIN)
root['reference_scale'] = SCALE

body = pivot('Body', (337, 222), 0, root)
head = pivot('Head', (402, 226), .70, body)

STAR_LANDMARKS = [('CrownStar',361,137,25,head),('TopStar',314,67,23,body),
                  ('WoolStar',184,287,23,body),('ChestStar',443,322,19,body),
                  ('LowerStar',302,332,14,body)]
def star_outline(cx,cy,radius):
    return [(cx+math.sin(i*math.pi/5)*radius*(1 if i%2 == 0 else .49),
             cy-math.cos(i*math.pi/5)*radius*(1 if i%2 == 0 else .49)) for i in range(10)]
star_masks = {name: largest_component((abs(xx-cx)<r+3)&(abs(yy-cy)<r+3)&
              (pixels[:,:,0]-pixels[:,:,2]>.17)&(pixels[:,:,1]-pixels[:,:,2]>.09))
              for name,cx,cy,r,_ in STAR_LANDMARKS}
body_gold = [star_masks[name] for name,_,_,_,parent in STAR_LANDMARKS if parent == body]
head_gold = [star_masks[name] for name,_,_,_,parent in STAR_LANDMARKS if parent == head]

body_obj, _ = surface('BodyWool', body_mask, (324, 206), body, body_front,
                      # Deliberately shallow: this is a living 2.5D relief,
                      # not an invented turnaround behind the original art.
                      rear_depth=.14, hide_regions=(head_mask, *ear_masks, *body_gold))
# The external contour is the body relief itself enlarged by only 0.2%, then
# placed immediately behind the painted surface.  This preserves the original
# cloud-like scallops exactly and avoids a screen-space halo when the view moves.
outline_material = bpy.data.materials.new('Carol • soft lavender contour')
outline_material.use_nodes = True
outline_nodes = outline_material.node_tree.nodes
outline_nodes.clear()
outline_output = outline_nodes.new('ShaderNodeOutputMaterial')
outline_bsdf = outline_nodes.new('ShaderNodeBsdfPrincipled')
outline_bsdf.inputs['Base Color'].default_value = (*linear((.949, .984, 1.)), 1)
outline_bsdf.inputs['Roughness'].default_value = 1
outline_material.node_tree.links.new(outline_bsdf.outputs['BSDF'], outline_output.inputs['Surface'])
contour_mesh = body_obj.data.copy()
contour_center = point(324, 206, 0)
for vert in contour_mesh.vertices:
    vert.co.x = contour_center.x + (vert.co.x-contour_center.x)*1.002
    vert.co.z = contour_center.z + (vert.co.z-contour_center.z)*1.002
    vert.co.y += .006
contour_mesh.materials.clear(); contour_mesh.materials.append(outline_material)
contour = bpy.data.objects.new('ReferenceContour', contour_mesh)
bpy.context.collection.objects.link(contour)
parent_keep(contour, body)
contour['construction'] = 'scaled body relief behind the painted silhouette; no invented rear detail'
head_obj, _ = surface('HeadWool', head_mask, (398, 214), head, head_front,
                      rear_depth=.12, hide_regions=(face_mask, *head_gold), rings=44, segments=192)
face, face_coords = surface('Face', face_mask, (424, 242), head, face_front,
                            rear_depth=.08, kind='skin', rings=62, segments=224)

bpy.context.view_layer.update()
attachment_surfaces = {}
for parent, obj in ((body,body_obj),(head,head_obj)):
    attachment_surfaces[parent.name] = BVHTree.FromPolygons(
        [obj.matrix_world@v.co for v in obj.data.vertices],
        [list(p.vertices) for p in obj.data.polygons])
def attachment_depth(parent,x,y):
    hit,_,_,_ = attachment_surfaces[parent.name].ray_cast(point(x,y,5),Vector((0,1,0)))
    if hit is None:
        raise ValueError('Ornament has no supporting wool: '+parent.name+str((x,y)))
    return -hit.y

# Facial warps use the measured eye-line basis (-19 degrees in image space).
# A dense, continuous skin topology lets the actual painted eyelids close and
# cheeks lift. No eye visibility swap, circular face plate, or replacement PNG.
face.shape_key_add(name='Basis')
KEYS = ['Blink', 'Smile', 'Surprise', 'Squint', 'LookLeft', 'LookRight', 'LookUp', 'LookDown']
shape_keys = {name: face.shape_key_add(name=name) for name in KEYS}
eye_centers = [(375, 250), (474, 216)]
axis = Vector((.947, -.322))
vertical = Vector((.322, .947))
for index, (x, y, r, is_front) in enumerate(face_coords):
    if not is_front:
        continue
    for name, key in shape_keys.items():
        dx = dy = dz = 0.
        for ex, ey in eye_centers:
            u = (x-ex)*axis.x+(y-ey)*axis.y
            v = (x-ex)*vertical.x+(y-ey)*vertical.y
            influence = math.exp(-((u/36)**6+(v/40)**6))
            if name in ('Blink', 'Squint'):
                closing = .985 if name == 'Blink' else .68
                shift = (-v*closing + (u*u/135-2.8)*closing)*influence
                dx += vertical.x*shift; dy += vertical.y*shift
            elif name.startswith('Look'):
                amount = influence*2.2
                dx += amount*((name == 'LookRight')-(name == 'LookLeft'))
                dy += amount*((name == 'LookDown')-(name == 'LookUp'))
        mouth = math.exp(-(((x-431)/25)**4+((y-254)/22)**4))
        if name == 'Smile':
            dx += (x-431)*.12*mouth
            dy -= 3.3*mouth
            dz += .015*mouth
        elif name == 'Surprise':
            dx -= (x-431)*.19*mouth
            dy += (y-252)*.26*mouth
            dz += .008*mouth
        key.data[index].co += Vector((dx*SCALE, -dz, -dy*SCALE))

for side, coords, center, attach_at, depth in [
    ('L', EAR_L, (268, 271), (304, 246), .96),
    ('R', EAR_R, (544, 192), (519, 186), .86),
]:
    ear = pivot('Ear'+side, attach_at, depth-.06, head)
    surface('EarOuter'+side, polygon_mask(rounded_trace(coords)), center, ear,
            lambda x, y, r, d=depth: d+.09*math.sqrt(max(0, 1-r*r)),
            rear_depth=.15, kind='ear', rings=20, segments=112)
    # Named nodes retained for existing integrations; facial pixels deform above.
    pivot('Eye'+side, eye_centers[0 if side == 'L' else 1], 1.24, head)
    pivot('ClosedEye'+side, eye_centers[0 if side == 'L' else 1], 1.24, head)
pivot('Mouth', (431, 254), 1.25, head)

# No independent leg objects.  The feet are painted into BodyWool above, so
# every reaction preserves the exact joined silhouette of the source artwork.

# Real crescent geometry, following the concavity rather than a filled polygon.
# Artwork supplies the gold's painted highlights; the reverse is warm gold.
moon_center = (218, 172)
moon_verts, moon_uv, moon_faces = [], [], []
for front_side in (True, False):
    for i in range(81):
        t = i/80
        outer_a = math.radians(-66-240*t)
        inner_a = math.radians(-104-157*t)
        ox, oy = 218+45*math.cos(outer_a), 172+48*math.sin(outer_a)
        ix, iy = 235+30*math.cos(inner_a), 158+33*math.sin(inner_a)
        # Tips coincide, making a closed crescent strip.
        if i in (0, 80):
            ix, iy = ox, oy
        for x, y in ((ox, oy), (ix, iy)):
            depth = body_front(x, y, .57)+(.025 if front_side else -.015)
            moon_verts.append(point(x, y, depth)); moon_uv.append((x/W, 1-y/H))
for i in range(80):
    j = i*2
    moon_faces += [(j, j+2, j+3, j+1), (j+162, j+163, j+165, j+164),
                   (j, j+162, j+164, j+2), (j+1, j+3, j+165, j+163)]
mesh = bpy.data.meshes.new('Moon'); mesh.from_pydata(moon_verts, [], moon_faces)
mesh.materials.append(projection); mesh.materials.append(reconstructed)
uv = mesh.uv_layers.new(name='ReferenceProjection')
color_attr = mesh.color_attributes.new(name='Paint', type='BYTE_COLOR', domain='CORNER')
for poly in mesh.polygons:
    poly.use_smooth = True
    poly.material_index = 0 if poly.index%4 == 0 else 1
    for li in poly.loop_indices:
        uv.data[li].uv = moon_uv[mesh.loops[li].vertex_index]
        color_attr.data[li].color = (*linear((1, .88, .49)), 1)
bm = bmesh.new(); bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
moon = bpy.data.objects.new('Moon', mesh); bpy.context.collection.objects.link(moon)
parent_keep(moon, body)

# Stars in the fleece are sculpted in place, with the reference texture. Orbital
# stars/clouds are separate closed pieces, not accidentally fused to the sheep.
for name, cx, cy, radius, parent in STAR_LANDMARKS:
    outline = star_outline(cx,cy,radius)
    surface(name, star_masks[name], (cx, cy), parent,
            lambda x,y,r,p=parent: attachment_depth(p,x,y)+.018+.02*(1-r*r),
            rear_depth=.025, kind='gold', rings=9, segments=80)

# A deliberately visible, round tail peeks from Carol's rear (the illustration's
# left side).  It sits behind the body volume so it reads as one soft tuft rather
# than a new limb painted across the source artwork.
# The tail is the lower-left atmosphere cloud, re-used at the rear tip and
# lightly pink-tinted. Its traced silhouette and painterly texture therefore
# match the existing clouds exactly.
# The visible tuft sits at x=72, but rotations must hinge where it joins the
# rear fleece.  Keeping the surface world-space gives the tail a real root.
tail = pivot('Tail', (123, 210), .22, body)
tail_source_mask = largest_component((((xx-125)/48)**2 + ((yy-346)/37)**2 < 1) & (pixels[:, :, 3] > .3))
tail_mask = np.roll(np.roll(tail_source_mask, 210-346, axis=0), 72-125, axis=1)
tail_obj, _ = surface('TailWool', tail_mask, (72, 209), tail,
                      lambda x, y, r: .22+.19*math.sqrt(max(0, 1-r*r)),
                      rear_depth=.12, kind='tailcloud', rings=22, segments=112, hide_regions=())
tail_obj['construction'] = 'lower-left atmosphere cloud silhouette and watercolor, pink-tinted for tail'

# Ambient accents from the original sit in the world, separately from anatomy.
ambient = pivot('CarolAtmosphere', ORIGIN, 0)
ACCENTS = [(125, 127, 35, 25), (535, 97, 43, 37), (125, 346, 48, 37),
           (538, 328, 53, 38), (193, 379, 36, 20), (493, 375, 47, 25),
           (173, 88, 28, 32), (476, 48, 33, 35), (565, 150, 27, 28),
           (574, 267, 31, 32), (98, 272, 23, 25)]
for i, (cx, cy, rx, ry) in enumerate(ACCENTS):
    region = ((xx-cx)/rx)**2+((yy-cy)/ry)**2 < 1
    mask = largest_component(region & (pixels[:, :, 3] > .3))
    if not np.any(mask):
        continue
    obj, _ = surface('Atmosphere%02d' % i, mask, (cx, cy), ambient,
                      lambda x, y, r: -.05+.13*math.sqrt(max(0, 1-r*r)),
                      rear_depth=.12, kind='wool' if i < 6 else 'gold', rings=14, segments=96)
    obj['ambient'] = True

landmarks = {
    'source': str(SOURCE.relative_to(ROOT)), 'sha256': root['source_sha256'],
    'size': [W, H], 'origin': list(ORIGIN), 'world_units_per_pixel': SCALE,
    'eyes': eye_centers, 'eye_line_degrees': -18.96,
    'face_outline': FACE, 'head_outline': HEAD, 'ears': [EAR_L, EAR_R],
    'legs': LEGS, 'moon_center': moon_center,
    'wool_locks': {'body': BODY_LOCKS, 'head': HEAD_LOCKS},
    'limitations': ['The reverse and occluded surfaces are authored interpretations.',
                    'Source projection defines the reference view, not an unseen orthographic turnaround.'],
}
(OUT / 'reference-landmarks.json').write_text(json.dumps(landmarks, ensure_ascii=False, indent=2), encoding='utf-8')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(WORK / 'carol-reference.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT / 'carol.glb'), export_format='GLB',
                         export_animations=False, export_cameras=False, export_lights=False,
                         export_yup=True, export_extras=True)
print('CAROL_REFERENCE_EXPORTED', (OUT/'carol.glb').stat().st_size,
      'meshes', len([o for o in bpy.data.objects if o.type == 'MESH']))
