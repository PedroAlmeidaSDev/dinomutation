// Minimal stand-in for the Phaser values game logic touches at runtime.
const between = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
const Phaser = {
  BlendModes: { ADD: 1, NORMAL: 0 },
  Math: { Between: between, FloatBetween: (min, max) => min + Math.random() * (max - min) },
};
export default Phaser;
