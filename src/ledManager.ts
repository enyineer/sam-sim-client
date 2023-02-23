import { Gpio } from "onoff";
import chalk from "chalk";

enum LEDState {
  ON,
  OFF,
}

export class LEDManager {
  private readonly ledPins: Gpio[];
  private readonly ledDuration: number;

  private currentTimeout: ReturnType<typeof setInterval> | null;

  constructor() {
    const ledPins = process.env.LED_PINS;
    const ledDuration = process.env.LED_DURATION;

    if (ledPins === undefined) {
      this.ledPins = [];
      console.info('LED_PINS was not set in .env - LEDs won\'t flash on new alerts.');
    } else {
      this.ledPins = ledPins.split(',').map(el => {
        const parsedEl = parseInt(el);

        if (Number.isNaN(parsedEl)) {
          throw new Error(`LED_PINS contains non numeric element ${el}.`);
        }

        return new Gpio(parsedEl, 'out');
      });
    }

    if (ledDuration === undefined) {
      const DEFAULT_LED_DURATION = 30;
      console.info(`LED_DURATION was not set in .env - Setting to default duration of ${DEFAULT_LED_DURATION} seconds.`);
      this.ledDuration = DEFAULT_LED_DURATION;
    } else {
      const parsedEl = parseInt(ledDuration);

      if (Number.isNaN(parsedEl)) {
        throw new Error(`LED_DURATION is non numeric ${ledDuration}`);
      }

      this.ledDuration = parsedEl;
    }

    this.currentTimeout = null;

    this.reset();

    process.once('SIGTERM', () => this.reset());
    process.once('SIGINT', () => this.reset());
  }

  async startFlashing() {
    console.debug(`Starting LEDs for ${this.ledDuration} seconds.`);
    await this.reset();
    await this.setLeds(LEDState.ON);
    this.currentTimeout = setTimeout(async () => {
      await this.reset();
    }, this.ledDuration * 1000);
  }

  async reset() {
    console.debug(`Resetting LEDs`);
    if (this.currentTimeout !== null) {
      clearTimeout(this.currentTimeout);
    }
    await this.setLeds(LEDState.OFF);
  }

  private async setLeds(state: LEDState) {
    console.debug(`Setting LEDs states to: ${state === LEDState.ON ? chalk.green('ON') : chalk.red('OFF')}`)
    for (const led of this.ledPins) {
      await led.write(LEDState.ON ? 1 : 0);
    }
  }
}