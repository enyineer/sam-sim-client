import { Gpio } from "onoff";
import chalk from "chalk";

enum LEDState {
  ON,
  OFF,
}

export class LEDManager {
  private readonly ledPins: { num: number, pin: Gpio}[];
  private readonly ledDuration: number;

  private currentTimeout: ReturnType<typeof setInterval> | null;

  constructor() {
    const ledPinsConf = process.env.LED_PINS;
    const ledDurationConf = process.env.LED_DURATION;

    if (ledPinsConf === undefined) {
      this.ledPins = [];
      console.warn('LED_PINS was not set in .env - LEDs won\'t flash on new alerts.');
    } else {
      this.ledPins = ledPinsConf.split(',').map(el => {
        const parsedEl = parseInt(el);

        if (Number.isNaN(parsedEl)) {
          throw new Error(`LED_PINS contains non numeric element ${el}.`);
        }
        console.info(`Configuring output to GPIO ${parsedEl}`);
        return {
          num: parsedEl,
          pin: new Gpio(parsedEl, 'out'),
        };
      });
    }

    if (ledDurationConf === undefined) {
      const DEFAULT_LED_DURATION = 30;
      console.info(`LED_DURATION was not set in .env - Setting to default duration of ${DEFAULT_LED_DURATION} seconds.`);
      this.ledDuration = DEFAULT_LED_DURATION;
    } else {
      const parsedEl = parseInt(ledDurationConf);

      if (Number.isNaN(parsedEl)) {
        throw new Error(`LED_DURATION is non numeric ${ledDurationConf}`);
      }

      this.ledDuration = parsedEl;
    }

    this.currentTimeout = null;

    this.reset();

    process.once('SIGTERM', () => this.turnOff());
    process.once('SIGINT', () => this.turnOff());
  }

  async turnOff() {
    await this.reset();
    for (const led of this.ledPins) {
      console.debug(`Removing GPIO ${led.num}`);
      led.pin.unexport();
    }
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
    for (const led of this.ledPins) {
      console.debug(`Setting GPIO ${led.num} to ${state === LEDState.ON ? chalk.green('ON') : chalk.red('OFF')}`);
      led.pin.writeSync(LEDState.ON ? 1 : 0);
    }
  }
}
