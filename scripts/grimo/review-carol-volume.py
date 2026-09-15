"""Render reproducible, unpainted turnaround views of the current sculpture."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'output/playwright/carol-rebuild'
bpy.ops.wm.open_mainfile(filepath=str(WORK / 'carol-reference.blend'))
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'SINGLE'
scene.display.shading.single_color = (.65, .65, .65)
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'BOTH'
scene.display.shading.background_type = 'WORLD'
scene.world.color = (.12, .12, .12)
scene.render.resolution_x = 700
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
for obj in scene.objects:
    if obj.name.startswith('Atmosphere'):
        obj.hide_render = True
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 4.2
scene.camera = camera
target = Vector((0, 0, 1.4))
for angle in (0, 45, 90, 180):
    radians = math.radians(angle)
    camera.location = target + Vector((math.sin(radians)*8, -math.cos(radians)*8, 0))
    camera.rotation_euler = (target-camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(WORK / ('clay-%03d.png' % angle))
    bpy.ops.render.render(write_still=True)
