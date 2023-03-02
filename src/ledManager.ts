import { Gpio } from "pigpio";
import chalk from "chalk";
import { Logger } from './logger';

enum LEDState {
  ON = 1,
  OFF = 0,
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
      Logger.l.warn('LED_PINS was not set in .env - LEDs won\'t flash on new alerts');
    } else {
      this.ledPins = ledPinsConf.split(',').map(el => {
        const parsedEl = parseInt(el);

        if (Number.isNaN(parsedEl)) {
          throw new Error(`LED_PINS contains non numeric element ${el}`);
        }

        Logger.l.info(`Adding GPIO ${parsedEl} as output`);
        
        const pin = new Gpio(parsedEl, { mode: Gpio.OUTPUT, alert: true });

        pin.on('alert', (value) => {
          Logger.l.debug(`Received new state for GPIO ${parsedEl}: ${this.getTextForBinary(value)}`);
        });

        return {
          num: parsedEl,
          pin,
        };
      });
    }

    if (ledDurationConf === undefined) {
      Logger.l.warn(`LED_DURATION was not set in .env - Setting to default duration of ${this.DEFAULT_LED_DURATION} seconds`);
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

    process.once('SIGTERM', () => this.reset());
    process.once('SIGINT', () => this.reset());
  }

  async startFlashing(duration = this.ledDuration) {
    await this.reset();
    Logger.l.debug(`Starting LEDs for ${duration} seconds`);
    await this.setLeds(LEDState.ON);
    this.currentTimeout = setTimeout(async () => {
      Logger.l.debug(`Flashing for ${duration} seconds finished`);
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

  private async setLeds(state: LEDState) {
    for (const led of this.ledPins) {
      led.pin.digitalWrite(LEDState.ON ? 1 : 0);
      Logger.l.debug(`Setting new state for GPIO ${led.num}: ${this.getTextForBinary(state)}`);
    }
  }

  private getTextForBinary(binary: 0 | 1) {
    return binary === 1 ? chalk.green('ON') : chalk.red('OFF');
  }
}
