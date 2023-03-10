import { AlarmType } from "./AlarmType";
import path from "path";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { Bucket } from "@google-cloud/storage";
import which from "which";
import { exec } from "child_process";
import { Logger } from './logger';
import chalk from 'chalk';

const piUser = process.env.PI_USER;

if (piUser === undefined) {
  throw new Error(`PI_USER is not defined in .env`);
}

export class SoundPlayer {
  static readonly cachePath = path.join(__dirname, "..", "cache");
  static readonly assetsPath = path.join(__dirname, "assets");

  static async playAlarm(
    alarmType: AlarmType,
    bucketPath: string,
    bucket: Bucket,
  ) {
    const paths: string[] = [];
    const gongPath = await this.getGongPath(alarmType);

    if (gongPath !== null) {
      paths.push(gongPath);
    }

    // May be undefined if not tts text was added to alarm
    if (bucketPath) {
      paths.push(await this.getTtsPath(bucketPath, bucket));
    }

    await this.play(paths);
  }

  static async getGongPath(alarmType: AlarmType) {
    let gongPath: string | null;

    switch (alarmType) {
      case AlarmType.EINZELFAHRZEUGALARM:
        gongPath = path.join(
          SoundPlayer.assetsPath,
          "einzelfahrzeug-alarm_mit_gong.wav"
        );
        break;
      case AlarmType.VORALARM:
        gongPath = path.join(SoundPlayer.assetsPath, "vor-alarm_mit_gong.wav");
        break;
      case AlarmType.ZUGALARM:
        gongPath = path.join(SoundPlayer.assetsPath, "zug-alarm_mit_gong.wav");
        break;
      case AlarmType.KEINER:
        gongPath = null;
        break;
      default:
        throw new Error(`No file mapping for GongType ${alarmType}`);
    }

    if (gongPath === null) {
      Logger.l.debug(
        `Not playing gong because gongPath for gong ${alarmType} is null`
      );
      return gongPath;
    }

    if (!existsSync(gongPath)) {
      throw new Error(`Could not find Gong ${alarmType} at path ${gongPath}`);
    }

    return gongPath;
  }

  static async getTtsPath(bucketPath: string, bucket: Bucket) {
    const file = bucket.file(bucketPath);
    const ttsPath = path.join(SoundPlayer.cachePath, file.name);

    if (!existsSync(ttsPath)) {
      Logger.l.debug(
        `Downloading ${file.name} from Storage`
      );
      await mkdir(path.dirname(ttsPath), { recursive: true });
      const [mp3] = await file.download();
      await writeFile(ttsPath, mp3);
    }

    return ttsPath;
  }

  static async playStartupSound() {
    const startupPath = path.join(SoundPlayer.assetsPath, "winxp.mp3");
    try {
      await this.play([startupPath]);
    } catch (err) {
      Logger.l.error(`Could not play startup sound ${startupPath}`);
    }
  }

  private static async play(files: string[]) {
    let vlcExec;
    if (process.platform === "win32") {
      vlcExec = "vlc.exe";
    } else {
      vlcExec = "cvlc";
    }

    const vlcPath = await which(vlcExec, { nothrow: true });
    if (vlcPath === null) {
      throw new Error(
        "Could not find vlc on device. Please install vlc and if under windows, add it's installation folder to PATH environment variable"
      );
    }

    let command = `${vlcPath} ${files.join(' ')} vlc://quit`;

    // If run on linux, make sure that we prepend the command with runuser to make sure vlc is run without sudo privileges
    if (process.platform !== "win32") {
      command = `runuser -l ${piUser} -c "${command}"`;
    }

    Logger.l.debug(`Running: ${command}`);

    return new Promise<void>((res, rej) => {
      const vlcProcess = exec(command);

      if (vlcProcess.stdout) {
        vlcProcess.stdout.on('data', (chunk) => {
          Logger.l.debug(`[${chalk.green('VLC STDOUT')}]: ${chunk}`);
        });
      }

      if (vlcProcess.stderr) {
        vlcProcess.stderr.on('data', (chunk) => {
          Logger.l.debug(`[${chalk.red('VLC STDERR')}]: ${chunk}`);
        });
      }

      vlcProcess.on("exit", (code) => {
        if (code === 0) {
          res();
        } else {
          rej();
        }
      });
    });
  }
}
