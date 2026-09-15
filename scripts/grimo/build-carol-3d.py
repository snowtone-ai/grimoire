"""Reproducible Carol sculpture. Run with Blender --background --factory-startup --python.

Original design: assets/grimo/source/carol-transparent.png (unchanged).
No downloaded meshes/textures. Named transform pivots are the web animation rig.
"""
import bpy
import bmesh
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/grimo/carol-3d"
OUT.mkdir(parents=True, exist_ok=True)
random.seed(17)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)


def material(name, color, roughness=.75, metallic=0):
    color = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in color)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    mat.use_backface_culling = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return mat


cream = material('Wool • warm ivory', (.96, .88, .73))
lilac = material('Wool • lilac', (.67, .63, .89))
blue = material('Wool • cornflower', (.38, .55, .96))
pink_wool = material('Wool • blush', (.94, .73, .78))
face_mat = material('Face • vanilla', (1, .86, .69), .9)
brown = material('Ear and hoof • cocoa', (.23, .115, .075), .8)
inner = material('Ear • rose', (.82, .36, .33))
cheek = material('Cheek • peach', (1, .48, .45))
eye_mat = material('Eye • deep plum', (.038, .019, .031), .2)
iris = material('Eye • honey', (.48, .23, .085), .35)
gold = material('Star • butter gold', (1, .69, .19), .42, .15)
glint = material('Eye • starlight', (1, .96, .81), .25)
mouth_mat = material('Mouth • warm shadow', (.25, .064, .053))
tongue = material('Mouth • coral', (.97, .32, .29))


def attach(obj, parent):
    if parent:
        world = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = world
    return obj


def pivot(name, pos, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    bpy.context.view_layer.update()
    return attach(obj, parent)


def ellipsoid(name, pos, scale, mat, parent=None, segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=20, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in obj.data.polygons:
        p.use_smooth = True
    obj.data.materials.append(mat)
    return attach(obj, parent)


def wool(name, lobes, parent, colored=False):
    parts = [ellipsoid(name, p, s, cream, segments=20) for p, s in lobes]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    # A continuous, softened surface, not intersecting balls with dark seams.
    remesh = obj.modifiers.new('Sculpt union', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = .028
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth = obj.modifiers.new('Soft wool valleys', 'SMOOTH')
    smooth.factor = 1.25
    smooth.iterations = 5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    decimate = obj.modifiers.new('Web topology', 'DECIMATE')
    decimate.ratio = .48
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    # Vertex colors make broad watercolor-like patches without hard material seams.
    colors = obj.data.color_attributes.new(name='WoolTint', type='BYTE_COLOR', domain='CORNER')
    for poly in obj.data.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            v = obj.matrix_world @ obj.data.vertices[obj.data.loops[li].vertex_index].co
            mix = max(0, min(1, .68 + .48 * math.sin(v.x * 3.1 + v.z * 3.8) * math.cos(v.y * 3))) if colored else .06
            a, b = cream.diffuse_color, (blue.diffuse_color if v.x < 0 else lilac.diffuse_color)
            colors.data[li].color = tuple(a[i] * (1 - mix * .9) + b[i] * mix * .9 for i in range(3)) + (1,)
    # glTF multiplies vertex color by base color; white base preserves the painted palette.
    obj.data.materials.clear()
    painted = material(name + ' painted wool', (1, 1, 1))
    attr = painted.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'WoolTint'
    painted.node_tree.links.new(attr.outputs['Color'], painted.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    obj.data.materials.append(painted)
    return attach(obj, parent)


def wool_cluster(name, pos, scale, mat, parent):
    """Small readable tufts layered over the union mesh.

    The body remains one continuous collision surface, while these sparse clusters
    restore the hand-sculpted wool rhythm that voxel remeshing otherwise erases.
    """
    parts = []
    for index, (dx, dz, factor) in enumerate(((-.58, 0, .82), (0, .055, 1.0), (.58, 0, .82))):
        part = ellipsoid(f"{name}Part{index}",
                         (pos[0] + dx * scale[0], pos[1] - .018, pos[2] + dz * scale[2]),
                         (scale[0] * .62 * factor, scale[1] * .58, scale[2] * .58 * factor),
                         mat, None, 16)
        parts.append(part)
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts: part.select_set(True)
    bpy.context.view_layer.objects.active = parts[1]
    bpy.ops.object.join()
    cluster = bpy.context.object
    cluster.name = name
    for poly in cluster.data.polygons: poly.use_smooth = True
    return attach(cluster, parent)


def add_face_shape_keys(obj):
    """Exportable subtle facial morphs; runtime can blend them without renaming nodes."""
    obj.shape_key_add(name='Basis')
    smile = obj.shape_key_add(name='Smile')
    surprise = obj.shape_key_add(name='Surprise')
    squint = obj.shape_key_add(name='Squint')
    for vertex in obj.data.vertices:
        co = vertex.co
        lower = max(0.0, min(1.0, (-co.z + .08) / .48))
        front = max(0.0, min(1.0, (-co.y - .10) / .28))
        smile.data[vertex.index].co = co + Vector((0, -.018 * lower * front, .018 * lower * front))
        surprise.data[vertex.index].co = co + Vector((0, -.012 * front, .026 * front))
        upper = max(0.0, min(1.0, (co.z + .10) / .36))
        squint.data[vertex.index].co = co + Vector((0, .010 * upper * front, -.012 * upper * front))
    for key in (smile, surprise, squint): key.value = 0.0


def line(name, points, radius, mat, parent):
    bpy.ops.object.select_all(action='DESELECT')
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 16
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return attach(obj, parent)


def ornament(name, points, pos, depth, mat, parent):
    verts = [(x + pos[0], pos[1] + y, z + pos[2]) for y in (-depth/2, depth/2) for x, z in points]
    n = len(points)
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    bevel = obj.modifiers.new('Soft embroidered edge', 'BEVEL')
    bevel.width = min(.035, depth * .3)
    bevel.segments = 3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for p in mesh.polygons:
        p.use_smooth = True
    return attach(obj, parent)


def star(name, pos, size, mat, parent):
    points = [(math.sin(i*math.pi/5) * size*(1 if i%2 == 0 else .48),
               math.cos(i*math.pi/5) * size*(1 if i%2 == 0 else .48)) for i in range(10)]
    return ornament(name, points, pos, size*.35, mat, parent)


def blush(name, x, parent):
    """Flush lies on the cheek surface, with feathered vertex color, not raised stickers."""
    verts, colors, faces = [], [], []
    for ring in range(5):
        r = max(.001, ring/4)
        for i in range(32):
            a = i*math.tau/32
            vx, vz = x + math.cos(a)*.17*r, 1.285 + math.sin(a)*.1*r
            vy = -.77-.39*math.sqrt(max(.01, 1-vx*vx/.68**2-(vz-1.37)**2/.59**2))-.003
            verts.append((vx, vy, vz))
            strength = (1-r*r)*.75
            colors.append(tuple(face_mat.diffuse_color[c]*(1-strength)+cheek.diffuse_color[c]*strength for c in range(3))+(1,))
            if ring:
                j = ring*32+i
                faces.append((j, ring*32+(i+1)%32, (ring-1)*32+(i+1)%32, j-32))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
    attr = mesh.color_attributes.new(name='Flush', type='FLOAT_COLOR', domain='CORNER')
    for poly in mesh.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            attr.data[li].color = colors[mesh.loops[li].vertex_index]
    mat = material(name, (1, 1, 1))
    mat.use_backface_culling = False
    node = mat.node_tree.nodes.new('ShaderNodeVertexColor'); node.layer_name = 'Flush'
    mat.node_tree.links.new(node.outputs['Color'], mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return attach(obj, parent)


root = pivot('Carol', (0, 0, 0))
body = pivot('Body', (0, 0, 1.1), root)
lobes = [((0, .05, 1.22), (.94, .76, .88))]
for row, z in enumerate((.65, 1.05, 1.46, 1.85)):
    for i in range(10):
        angle = i * math.tau / 10 + row * .26
        radius = .79 if row in (1, 2) else .58
        p = (math.cos(angle)*radius, .05 + math.sin(angle)*radius*.77, z)
        s = (.31+random.random()*.09, .3, .28+random.random()*.08)
        lobes.append((p, s))
lobes += [((-.35, .08, 2.01), (.42, .4, .33)), ((.22, .16, 2.06), (.39, .4, .3))]
wool('BodyWool', lobes, body, True)
# Sparse clusters create a deliberate fleece pattern without turning the GLB into hair cards.
for index, (x, z, tint) in enumerate((
    (-.72, .83, blue), (-.47, .67, cream), (-.18, .72, lilac), (.18, .70, blue),
    (.49, .84, cream), (.72, 1.18, lilac), (-.78, 1.35, cream), (.76, 1.61, blue),
    (-.55, 1.78, lilac), (.47, 1.88, cream), (-.14, 2.08, blue),
)):
    wool_cluster(f'WoolCluster{index:02d}', (x, -.69 if abs(x) > .7 else -.72, z), (.16, .12, .12), tint, body)

for side, x in (('L', -.49), ('R', .49)):
    for end, y in (('Front', -.38), ('Back', .43)):
        leg = pivot('Leg' + side + end, (x, y, .55), root)
        ellipsoid('Hoof' + side + end, (x, y-.025, .28), (.18, .2, .23), brown, leg)
        for dx in (-.06, .06):
            line('Hoof seam', [(x+dx, y-.23, .19), (x+dx, y-.244, .27)], .009, mouth_mat, leg)

head = pivot('Head', (0, -.54, 1.47), body)
face = ellipsoid('Face', (0, -.77, 1.37), (.68, .39, .59), face_mat, head, 64)
add_face_shape_keys(face)
frame = []
for i in range(14):
    a = i * math.tau / 14
    size = .21 + .035*math.sin(i*2.3)
    frame.append(((math.sin(a)*.66, -.70 + .045*math.cos(a), 1.43+math.cos(a)*.57), (size, .27, size)))
frame += [((-.26, -.72, 1.98), (.3, .32, .28)), ((.08, -.76, 2.02), (.31, .32, .27)), ((.36, -.69, 1.94), (.26, .28, .23))]
wool('HeadWool', frame, head)
for index, (x, z) in enumerate(((-.58, 1.48), (-.39, 1.96), (-.10, 2.08), (.20, 2.07), (.51, 1.87), (.61, 1.48))):
    wool_cluster(f'HeadWoolCluster{index:02d}', (x, -.96, z), (.11, .09, .10), (lilac if index % 2 else cream), head)
for side, sign in (('L', -1), ('R', 1)):
    ear = pivot('Ear' + side, (sign*.62, -.54, 1.61), head)
    obj = ellipsoid('EarOuter' + side, (sign*.91, -.62, 1.49), (.4, .125, .185), brown, ear)
    obj.rotation_euler.y = sign * -.36
    obj = ellipsoid('EarInner' + side, (sign*.94, -.733, 1.49), (.275, .025, .113), inner, ear)
    obj.rotation_euler.y = sign * -.36
    x = sign*.285
    eye = pivot('Eye' + side, (x, -1.108, 1.48), head)
    ellipsoid('EyeGlass' + side, (x, -1.112, 1.48), (.162, .069, .216), eye_mat, eye)
    ellipsoid('Iris' + side, (x, -1.17, 1.411), (.123, .02, .111), iris, eye)
    star('EyeStar' + side, (x+.029, -1.196, 1.418), .055, gold, eye)
    ellipsoid('EyeGlint' + side, (x-.047, -1.184, 1.574), (.047, .014, .057), glint, eye, 20)
    ellipsoid('EyeSmallGlint' + side, (x+.067, -1.173, 1.51), (.019, .009, .022), glint, eye, 16)
    closed = pivot('ClosedEye' + side, (x, -1.12, 1.47), head)
    line('Happy lid' + side, [(x-.14, -1.16, 1.465), (x, -1.19, 1.515), (x+.14, -1.16, 1.465)], .017, brown, closed)
    blush('Cheek' + side, sign*.425, head)

ellipsoid('Nose', (0, -1.172, 1.35), (.043, .027, .027), brown, head)
mouth = pivot('Mouth', (0, -1.138, 1.245), head)
ellipsoid('MouthOpen', (0, -1.135, 1.245), (.097, .025, .101), mouth_mat, mouth)
ellipsoid('Tongue', (0, -1.163, 1.206), (.065, .014, .051), tongue, mouth)
line('Smile', [(-.12, -1.143, 1.314), (-.07, -1.166, 1.281), (0, -1.17, 1.305), (.07, -1.166, 1.281), (.12, -1.143, 1.314)], .012, brown, head)
star('CrownStar', (0, -1.11, 2.02), .17, gold, head)
star('ChestStar', (.39, -.90, .88), .125, gold, body)
star('WoolStar', (-.77, -.54, .94), .13, gold, body)
# Explicit quad strip avoids the unstable triangulation of a concave crescent ngon.
moon_verts, moon_faces = [], []
for depth in (-.035, .035):
    for i in range(33):
        a = math.radians(57 + i*246/32)
        b = math.radians(91 + i*178/32)
        moon_verts += [(-.91+math.cos(a)*.28, -.66+depth, 1.95+math.sin(a)*.28),
                       (-.91+.157+math.cos(b)*.243, -.66+depth, 1.95+math.sin(b)*.243)]
for i in range(32):
    j = i*2
    moon_faces += [(j,j+2,j+3,j+1), (j+66,j+67,j+69,j+68),
                   (j,j+66,j+68,j+2), (j+1,j+3,j+69,j+67)]
moon_faces += [(0,1,67,66), (64,130,131,65)]
mesh = bpy.data.meshes.new('Moon'); mesh.from_pydata(moon_verts, [], moon_faces)
bm = bmesh.new(); bm.from_mesh(mesh)
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(mesh); bm.free()
moon = bpy.data.objects.new('Moon', mesh); bpy.context.collection.objects.link(moon)
moon.data.materials.append(gold)
for poly in mesh.polygons: poly.use_smooth = True
attach(moon, body)
tail = pivot('Tail', (0, .77, 1.05), body)
wool('TailWool', [((0, .82, 1.04), (.28, .25, .25)), ((-.15, .88, 1.10), (.19, .2, .18)), ((.14, .91, 1.05), (.2, .2, .19))], tail, True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT / 'carol.glb'), export_format='GLB',
                         export_animations=False, export_cameras=False, export_lights=False,
                         export_yup=True, export_extras=True)
print('CAROL_EXPORTED', (OUT / 'carol.glb').stat().st_size)
