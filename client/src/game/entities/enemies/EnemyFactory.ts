import type Phaser from 'phaser';
import { ENEMIES, type EnemyId } from '../../../data/enemies';
import { Enemy, type EnemyBehavior, type EnemyScaling } from './Enemy';
import { CompyBehavior } from './Compy';
import { WildRaptorBehavior } from './WildRaptor';
import { DilophosaurusBehavior } from './Dilophosaurus';
import { PachyBehavior } from './Pachy';
import { PterosaurBehavior } from './Pterosaur';
import { CarnotaurusBehavior } from './Carnotaurus';
import { CarnotaurusAlphaBehavior } from './CarnotaurusAlpha';
import { GiganotosaurusBehavior } from './Giganotosaurus';

/** Registry: adding an enemy = a data entry + a behaviour class registered here. */
const BEHAVIORS: Record<EnemyId, () => EnemyBehavior> = {
  compy: () => new CompyBehavior(),
  wildRaptor: () => new WildRaptorBehavior(),
  dilophosaurus: () => new DilophosaurusBehavior(),
  pachy: () => new PachyBehavior(),
  pterosaur: () => new PterosaurBehavior(),
  carnotaurus: () => new CarnotaurusBehavior(),
  carnoAlpha: () => new CarnotaurusAlphaBehavior(),
  giganotosaurus: () => new GiganotosaurusBehavior(),
};

export function createEnemy(scene: Phaser.Scene, id: EnemyId, x: number, y: number, scaling: EnemyScaling): Enemy {
  const def = ENEMIES[id];
  return new Enemy(scene, def, x, y, scaling, BEHAVIORS[def.behavior]());
}
