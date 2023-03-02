import path from "path";
import { Firestore } from "@google-cloud/firestore";
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";
import { LEDManager } from "./ledManager";
import { SoundPlayer } from "./soundPlayer";

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

if (majorVersion < 10 || majorVersion > 16) {
  throw new Error(`NodeJS v${majorVersion} is not supported. Must be >= 10 and <= 16!`);
}

dotenv.config();

const projectId = process.env.GOOGLE_PROJECT_ID;
const saKeyName = process.env.GOOGLE_SA_NAME;
const bucketName = process.env.BUCKET_NAME;
const stationId = process.env.FIRESTORE_STATION_ID;

if (projectId === undefined) {
  throw new Error(`GOOGLE_PROJECT_ID not set.`);
}

if (saKeyName === undefined) {
  throw new Error("GOOGLE_SA_NAME not set.");
}

const saKeyPath = path.join(__dirname, "..", "serviceAccount", saKeyName);

if (bucketName === undefined) {
  throw new Error(`BUCKET_NAME not set.`);
}

if (stationId === undefined) {
  throw new Error(`FIRESTORE_STATION_ID not set.`);
}

const firestore = new Firestore({
  projectId,
  keyFilename: saKeyPath,
});

const storage = new Storage({
  projectId,
  keyFilename: saKeyPath,
});

const collectionPath = `stations/${stationId}/alarms`;
const alarmsFirestore = firestore.collection(collectionPath);
const alarmsStorage = storage.bucket(bucketName);

const ledManager = new LEDManager();

let initialSnapshot = true;

const main = async () => {
  console.info(
    `Starting snapshot listener for collection ${collectionPath} in project ${projectId}`
  );

  SoundPlayer.playStartupSound();

  alarmsFirestore.onSnapshot(async (snapshot) => {
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
        ledManager.startFlashing();
        await SoundPlayer.playAlarm(
          data.type,
          data.bucketPath,
          alarmsStorage
        );
      }

      if (change.type === "added" && data.ttsText === "") {
        ledManager.startFlashing();
        SoundPlayer.playGong(data.type);
      }
    }
  });
};

main().catch((err) => console.error(err));
