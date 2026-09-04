import { SensorBarCard } from './card/SensorBarCard.js';
import { SensorBarCardPlusEditor } from './editor/SensorBarCardPlusEditor.js';

customElements.define('sensor-bar-card-plus-with-trend', SensorBarCard);
customElements.define('sensor-bar-card-plus-with-trend-editor', SensorBarCardPlusEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'sensor-bar-card-plus-with-trend',
  name: 'Sensor Bar Card Plus with Trend',
  description: 'Animated, colour-coded horizontal bar card with history-based trend indicators.',
});
