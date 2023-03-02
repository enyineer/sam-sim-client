import { AlarmType } from "./AlarmType";
import path from "path";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { Bucket } from "@google-cloud/storage";
import which from "which";
import { exec } from "child_process";
import { Logger } from './logger';

export class SoundPlayer {
  static readonly cachePath = path.join(__dirname, "..", "cache");
  static readonly assetsPath = path.join(__dirname, "assets");

  static async playAlarm(
    alarmType: AlarmType,
    bucketPath: string,
    bucket: Bucket
  ) {
    await this.playGong(alarmType);
    const localPath = await this.downloadTtsFile(bucketPath, bucket);
    await this.playTtsFile(localPath);
  }

  static async playGong(alarmType: AlarmType) {
    let gongPath = this.getGongPath(alarmType);

    if (gongPath === null) {
      Logger.l.debug(
        `Not playing gong because gongPath for gong ${alarmType} is null`
      );
      return;
    }

    if (!existsSync(gongPath)) {
      throw new Error(`Could not find Gong ${alarmType} at path ${gongPath}`);
    }

    Logger.l.debug(`Playing Gong ${alarmType} from ${gongPath}`);

    try {
      await this.play(gongPath);
    } catch (err) {
      Logger.l.error(`Could not play gong ${gongPath}: ${err}`);
    }
    
  }

  private static getGongPath(alarmType: AlarmType) {
    switch (alarmType) {
      case AlarmType.EINZELFAHRZEUGALARM:
        return path.join(
          SoundPlayer.assetsPath,
          "einzelfahrzeug-alarm_mit_gong.wav"
        );
      case AlarmType.VORALARM:
        return path.join(SoundPlayer.assetsPath, "vor-alarm_mit_gong.wav");
      case AlarmType.ZUGALARM:
        return path.join(SoundPlayer.assetsPath, "zug-alarm_mit_gong.wav");
      case AlarmType.KEINER:
        return null;
      default:
        throw new Error(`No file mapping for GongType ${alarmType}`);
    }
  }

  private static async downloadTtsFile(bucketPath: string, bucket: Bucket) {
    const file = bucket.file(bucketPath);
    const localPath = path.join(SoundPlayer.cachePath, file.name);

    if (!existsSync(localPath)) {
      Logger.l.debug(
        `File ${file.name} does not exist. Downloading from Storage`
      );
      await mkdir(path.dirname(localPath), { recursive: true });
      const [mp3] = await file.download();
      await writeFile(localPath, mp3);
    } else {
      Logger.l.debug(`File ${file.name} already existed. Returning cache path`);
    }

    return localPath;
  }

  private static async playTtsFile(localPath: string) {
    Logger.l.debug(`Playing tts file ${localPath}`);
    try {
      await this.play(localPath);
    } catch (err) {
      Logger.l.error(`Could not play tts file ${localPath}: ${err}`);
    }
  }

  static async playStartupSound() {
    const startupPath = path.join(SoundPlayer.assetsPath, "winxp.mp3");
    Logger.l.debug(`Playing startup sound from ${startupPath}`);
    try {
      await this.play(startupPath);
    } catch (err) {
      Logger.l.error(`Could not play startup sound ${startupPath}: ${err}`);
    }
  }

  private static async play(path: string) {
    let vlcExec;
    if (process.platform === "win32") {
      vlcExec = "vlc.exe";
    } else {
      vlcExec = "vlc";
    }

    const vlcPath = await which(vlcExec, { nothrow: true });
    if (vlcPath === null) {
      throw new Error(
        "Could not find vlc on device. Please install vlc and if under windows, add it's installation folder to PATH environment variable"
      );
    }
    return new Promise<string>((res, rej) => {
      const vlcProcess = exec(`${vlcPath} -Idummy ${path} vlc://quit`);

      let vlcStdOut = "";
      let vlcStdErr = "";

      if (vlcProcess.stdout) {
        vlcProcess.stdout.on('data', (chunk) => {
          vlcStdOut = vlcStdOut + `${chunk}\n`;
        });
      }

      if (vlcProcess.stderr) {
        vlcProcess.stderr.on('data', (chunk) => {
          vlcStdErr = vlcStdErr + `${chunk}\n`;
        });
      }

      vlcProcess.on("exit", (code) => {
        if (code === 0) {
          res(vlcStdOut);
        } else {
          rej(vlcStdErr);
        }
      });
    });
  }
}
