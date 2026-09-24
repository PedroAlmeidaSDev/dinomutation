// Lets Node run game source files headlessly: resolves extensionless TS imports and stubs Phaser.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
