import { AlarmType } from './AlarmType';
import path from "path";
import SoundPlay from "sound-play";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { Bucket } from '@google-cloud/storage';

export class SoundPlayer {
  static async playAlarm(alarmType: AlarmType, bucketPath: string, bucket: Bucket) {
    await this.playGong(alarmType);
    const localPath = await this.downloadTtsFile(bucketPath, bucket);
    await this.playTtsFile(localPath);
  }

  static async playGong(alarmType: AlarmType) {
    let gongPath = this.getGongPath(alarmType);

    if (gongPath === null) {
      console.debug(`Not playing gong because gongPath for gong ${alarmType} is null`);
      return;
    }

    if (!existsSync(gongPath)) {
      throw new Error(`Could not find Gong ${alarmType} at path ${gongPath}`);
    }

    console.debug(`Playing Gong ${alarmType} from ${gongPath}`);

    await SoundPlay.play(gongPath);
  }

  private static getGongPath(alarmType: AlarmType) {
    const assetsPath = path.join(__dirname, "assets");
    switch(alarmType) {
      case AlarmType.EINZELFAHRZEUGALARM:
        return path.join(assetsPath, "einzelfahrzeug-alarm_mit_gong.wav");
      case AlarmType.VORALARM:
        return path.join(assetsPath, "vor-alarm_mit_gong.wav");
      case AlarmType.ZUGALARM:
        return path.join(assetsPath, "zug-alarm_mit_gong.wav");
      case AlarmType.KEINER:
        return null;
      default:
        throw new Error(`No file mapping for GongType ${alarmType}`);
    }
  }

  private static async downloadTtsFile(bucketPath: string, bucket: Bucket) {
    const file = bucket.file(bucketPath);
    const cachePath = path.join(__dirname, "..", "cache");
    const localPath = path.join(cachePath, file.name);
    
    if (!existsSync(localPath)) {
      console.debug(`File ${file.name} does not exist. Downloading from Storage.`);
      await mkdir(path.dirname(localPath), { recursive: true });
      const [mp3] = await file.download();
      await writeFile(localPath, mp3, );
    } else {
      console.debug(`File ${file.name} already existed. Returning cache path.`);
    }

    return localPath;
  }

  private static async playTtsFile(localPath: string) {
    console.debug(`Playing tts file ${localPath}`);
    await SoundPlay.play(localPath);
  }
}