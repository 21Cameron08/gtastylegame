/** Tunable driving data. Units: kg, N, meters, seconds, radians. */
export interface VehicleDef {
  id: string;
  name: string;
  model: string;
  /** Default paint color (applied to MAT_Paint). */
  paint: string;
  mass: number;
  /** Center of mass height above the ground; lower = harder to roll over. */
  centerOfMassY: number;
  drive: 'rwd' | 'fwd' | 'awd';
  /** Total engine force at low speed, split across driven wheels. */
  engineForce: number;
  reverseForce: number;
  /** Meters/second where engine force fades to zero. */
  topSpeed: number;
  brakeForce: number;
  handbrakeForce: number;
  maxSteer: number;
  /** Max steer at high speed (speed-sensitive steering keeps it drivable). */
  maxSteerAtSpeed: number;
  steerSpeed: number;
  suspensionRestLength: number;
  suspensionTravel: number;
  suspensionStiffness: number;
  suspensionCompression: number;
  suspensionRelaxation: number;
  frictionSlip: number;
  /** Rear grip multiplier while the handbrake is held (lower = slides). */
  handbrakeGrip: number;
  sideFrictionStiffness: number;
}

export const PICKUP_WORK: VehicleDef = {
  id: 'pickup_work',
  name: 'Work Pickup',
  model: 'assets/vehicles/VEH_Pickup_Work.glb',
  paint: '#b7472a',
  mass: 1900,
  centerOfMassY: 0.55,
  drive: 'rwd',
  engineForce: 11000,
  reverseForce: 4500,
  topSpeed: 44,
  brakeForce: 90,
  handbrakeForce: 120,
  maxSteer: 0.6,
  maxSteerAtSpeed: 0.16,
  steerSpeed: 3.0,
  suspensionRestLength: 0.32,
  suspensionTravel: 0.25,
  suspensionStiffness: 32,
  suspensionCompression: 3.2,
  suspensionRelaxation: 4.2,
  frictionSlip: 2.2,
  handbrakeGrip: 0.35,
  sideFrictionStiffness: 1.0,
};
