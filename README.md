# Service Account setup

1. Go to Google Cloud Console
2. Open IAM & Admin
3. Open Service Accounts
4. Create a new Service Account for each installation
5. Create a new Key and download it
6. Save key to folder "serviceAccount" (Create it if not exists)
7. Set GOOGLE_SA_NAME=<keyfilename> in .env
8. Open IAM
9. Add role "Firebase Viewer" to the new Service Account