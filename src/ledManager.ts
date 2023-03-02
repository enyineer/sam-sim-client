import { Gpio } from "onoff";
import chalk from "chalk";
import { Logger } from './logger';

enum LEDState {
  ON,
  OFF,
}

export class LEDManager {
  private readonly ledPins: { num: number, pin: Gpio}[];
  private readonly ledDuration: number;
  private readonly DEFAULT_LED_DURATION = 30;

  private currentTimeout: ReturnType<typeof setInterval> | null;

  constructor() {
    const ledPinsConf = process.env.LED_PINS;
    const ledDurationConf = process.env.LED_DURATION;

    if (ledPinsConf === undefined) {
      this.ledPins = [];
      Logger.l.warn('LED_PINS was not set in .env - LEDs won\'t flash on new alerts.');
    } else {
      this.ledPins = ledPinsConf.split(',').map(el => {
        const parsedEl = parseInt(el);

        if (Number.isNaN(parsedEl)) {
          throw new Error(`LED_PINS contains non numeric element ${el}.`);
        }
        Logger.l.info(`Configuring output to GPIO ${parsedEl}`);
        
        const pin = new Gpio(parsedEl, 'out');

        if (!pin.accessible) {
          throw new Error(`GPIO ${parsedEl} is not accessible`);
        }

        return {
          num: parsedEl,
          pin,
        };
      });
    }

    if (ledDurationConf === undefined) {
      Logger.l.warn(`LED_DURATION was not set in .env - Setting to default duration of ${this.DEFAULT_LED_DURATION} seconds.`);
      this.ledDuration = this.DEFAULT_LED_DURATION;
    } else {
      const parsedEl = parseInt(ledDurationConf);

      if (Number.isNaN(parsedEl)) {
        throw new Error(`LED_DURATION is non numeric ${ledDurationConf}`);
      }

      this.ledDuration = parsedEl;
    }

    this.currentTimeout = null;

    this.setLeds(LEDState.OFF);

    process.once('SIGTERM', () => this.shutDown());
    process.once('SIGINT', () => this.shutDown());
  }

  async startFlashing(duration = this.ledDuration) {
    await this.reset();
    Logger.l.debug(`Starting LEDs for ${duration} seconds.`);
    await this.setLeds(LEDState.ON);
    this.currentTimeout = setTimeout(async () => {
      Logger.l.debug(`Flashing for ${duration} seconds finished.`);
      await this.reset();
    }, duration * 1000);
  }

  async reset() {
    Logger.l.debug(`Resetting LEDs`);
    if (this.currentTimeout !== null) {
      clearTimeout(this.currentTimeout);
    }
    await this.setLeds(LEDState.OFF);
  }

  private async shutDown() {
    await this.reset();
    for (const led of this.ledPins) {
      Logger.l.debug(`Removing GPIO ${led.num}`);
      led.pin.unexport();
    }
  }

  private async setLeds(state: LEDState) {
    for (const led of this.ledPins) {
      led.pin.writeSync(LEDState.ON ? 1 : 0);
      const newState = led.pin.readSync();
      Logger.l.debug(`Set GPIO ${led.num} to ${newState === 1 ? chalk.green('ON') : chalk.red('OFF')}`);
    }
  }
}
