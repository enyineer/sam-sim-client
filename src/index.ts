import dotenv from "dotenv";
dotenv.config();

import path from "path";
import { Firestore } from "@google-cloud/firestore";
import { Storage } from "@google-cloud/storage";
import { LEDManager } from "./ledManager";
import { SoundPlayer } from "./soundPlayer";
import { Logger } from './logger';

Logger.l.info(`Starting SAM-SIM Client... Please wait`);

const semverRegEx = /(\d+)\.(\d+)\.(\d+)/;
const nodeVersion = process.versions.node;
const versionMatches = semverRegEx.exec(nodeVersion);

if (versionMatches === null) {
  throw new Error(`Could not determine NodeJS version`);
}

const majorVersion = parseInt(versionMatches[1]);

if (Number.isNaN(majorVersion)) {
  throw new Error(`Detected major version of NodeJS is NaN`);
}

const supportedVersions = [10, 12, 14, 15, 16];

if (!supportedVersions.includes(majorVersion)) {
  throw new Error(`NodeJS v${majorVersion} is not supported. Must be one of: ${supportedVersions.join(', ')}`);
}

const projectId = process.env.GOOGLE_PROJECT_ID;
const saKeyName = process.env.GOOGLE_SA_NAME;
const bucketName = process.env.BUCKET_NAME;
const stationId = process.env.FIRESTORE_STATION_ID;

if (projectId === undefined) {
  throw new Error(`GOOGLE_PROJECT_ID not set`);
}

if (saKeyName === undefined) {
  throw new Error("GOOGLE_SA_NAME not set");
}

const saKeyPath = path.join(__dirname, "..", "serviceAccount", saKeyName);

if (bucketName === undefined) {
  throw new Error(`BUCKET_NAME not set`);
}

if (stationId === undefined) {
  throw new Error(`FIRESTORE_STATION_ID not set`);
}

const firestore = new Firestore({
  projectId,
  keyFilename: saKeyPath,
});

const storage = new Storage({
  projectId,
  keyFilename: saKeyPath,
});

const stationPath = `stations/${stationId}`;
const collectionPath = `stations/${stationId}/alarms`;
const stationDocument = firestore.doc(stationPath);
const alarmsCollection = firestore.collection(collectionPath);
const alarmsStorage = storage.bucket(bucketName);

const ledManager = new LEDManager();

let initialSnapshot = true;

const main = async () => {
  ledManager.startFlashing(5);
  await SoundPlayer.playStartupSound();

  const stationData = (await stationDocument.get()).data();

  if (stationData === undefined) {
    throw new Error(`Station at ${stationPath} returned undefined data`);
  }

  Logger.l.info(
    `Starting listener for new alarms at station "${stationData.name}" in Firebase project "${projectId}"`
  );

  alarmsCollection.onSnapshot(async (snapshot) => {
    // Do not react on the initial snapshot event. This contains old alarms
    if (initialSnapshot) {
      initialSnapshot = false;
      return;
    }

    for (const change of snapshot.docChanges()) {
      const data = change.doc.data();
      // If the change is for a modified doc, check if it was added to the newDocumentsList
      // This prevents old alarms from being player again if they're getting updated
      if (change.type === "modified" && data.bucketPath) {
        Logger.l.info(`Playing new alarm with TTS: ${data.type} / ${data.ttsText} / ${data.bucketPath}`);
        ledManager.startFlashing();
        await SoundPlayer.playAlarm(
          data.type,
          data.bucketPath,
          alarmsStorage,
        );
      }

      if (change.type === "added" && data.ttsText === "") {
        Logger.l.info(`Playing new alarm without TTS: ${data.type}`);
        ledManager.startFlashing();
        await SoundPlayer.playAlarm(
          data.type,
          data.bucketPath,
          alarmsStorage,
        );
      }
    }
  });
};

main().catch((err) => Logger.l.error(err));
