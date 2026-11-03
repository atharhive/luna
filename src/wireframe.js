/**
 * Wireframe toggle helpers for the PBR solid layer.
 * The flag lives on the layer group so meshes added later can pick it up.
 */

export const WIREFRAME_FLAG = 'wireframe';

export function applyWireframe(object, enabled) {
  object.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((material) => {
      material.wireframe = enabled;
      material.needsUpdate = true;
    });
  });
}

export function setSolidLayerWireframe(solidGroup, enabled) {
  solidGroup.userData[WIREFRAME_FLAG] = enabled;
  applyWireframe(solidGroup, enabled);
}

export function isSolidLayerWireframe(solidGroup) {
  return solidGroup.userData[WIREFRAME_FLAG] === true;
}
