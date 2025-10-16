/**
 * Helper utilities pour faciliter la migration de Cannon.js vers Rapier
 */

import * as THREE from 'three';

// Convertir THREE.Vector3 vers Rapier Vector
export function toRapierVector(threeVec) {
    return { x: threeVec.x, y: threeVec.y, z: threeVec.z };
}

// Convertir Rapier Vector vers THREE.Vector3
export function toThreeVector(rapierVec) {
    return new THREE.Vector3(rapierVec.x, rapierVec.y, rapierVec.z);
}

// Convertir THREE.Quaternion vers Rapier Rotation
export function toRapierRotation(threeQuat) {
    return { x: threeQuat.x, y: threeQuat.y, z: threeQuat.z, w: threeQuat.w };
}

// Convertir Rapier Rotation vers THREE.Quaternion
export function toThreeQuaternion(rapierRot) {
    return new THREE.Quaternion(rapierRot.x, rapierRot.y, rapierRot.z, rapierRot.w);
}

// Calculer la rotation Y depuis un quaternion Rapier
export function getYRotationFromQuaternion(quat) {
    // Euler angles from quaternion: yaw (Y rotation)
    const sinr_cosp = 2 * (quat.w * quat.x + quat.y * quat.z);
    const cosr_cosp = 1 - 2 * (quat.x * quat.x + quat.y * quat.y);

    const siny_cosp = 2 * (quat.w * quat.y + quat.z * quat.x);
    const cosy_cosp = 1 - 2 * (quat.y * quat.y + quat.z * quat.z);

    return Math.atan2(siny_cosp, cosy_cosp);
}

// Créer un quaternion Rapier depuis un angle Y (rotation autour de l'axe Y)
export function quaternionFromYRotation(angleY) {
    const halfAngle = angleY / 2;
    return {
        x: 0,
        y: Math.sin(halfAngle),
        z: 0,
        w: Math.cos(halfAngle)
    };
}

// Multiplier un vecteur par un quaternion (équivalent de CANNON vmult)
export function rotateVectorByQuaternion(vec, quat) {
    // Convert to THREE.js pour utiliser leur implémentation
    const threeVec = new THREE.Vector3(vec.x, vec.y, vec.z);
    const threeQuat = new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);
    threeVec.applyQuaternion(threeQuat);
    return { x: threeVec.x, y: threeVec.y, z: threeVec.z };
}
