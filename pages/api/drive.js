// pages/api/drive.js
import { google } from "googleapis";
async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth });
}
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { action, fileId } = req.body;
  try {
    const drive = await getDriveClient();
    if (action === "listFiles") {
      const response = await drive.files.list({
        q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`,
        fields: "files(id,name,mimeType,modifiedTime,size)",
      });
      return res.status(200).json({ files: response.data.files });
    }
    res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
