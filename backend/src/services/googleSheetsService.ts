import { google } from 'googleapis';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export class GoogleSheetsService {
  private static getOAuth2Client() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'postmessage' // Or your redirect URI if applicable
    );
  }

  static async syncQuizScores(
    quizId: number,
    quizName: string,
    sessionId: string,
    hostUserId: number,
    sheetId: string,
    scores: { userId: string; score: number; userName?: string }[]
  ): Promise<boolean> {
    try {
      // Validate sheet ID format (should be a long string of alphanumeric chars)
      if (!sheetId || sheetId.trim() === '') {
        console.error('GoogleSheetsService: Invalid sheet ID - empty or missing');
        throw new Error('Invalid Google Sheet ID: Sheet ID is empty');
      }

      // 1. Get host user's refresh token
      const [host] = await db.select().from(users).where(eq(users.id, hostUserId));

      if (!host || !host.refreshToken) {
        console.error(`GoogleSheetsService: No refresh token found for host ${hostUserId}`);
        throw new Error('Google authentication not found. Please authenticate with Google first.');
      }

      // 2. Set up auth client
      const oauth2Client = this.getOAuth2Client();
      oauth2Client.setCredentials({
        refresh_token: host.refreshToken
      });

      // Verify credentials by refreshing the token
      try {
        await oauth2Client.getAccessToken();
      } catch (authError: any) {
        console.error('GoogleSheetsService: Failed to refresh access token:', authError.message);
        throw new Error('Google authentication expired. Please re-authenticate with Google.');
      }

      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      // 3. Prepare data
      const timestamp = new Date().toISOString();
      const values = scores.map(s => [
        timestamp,
        quizName,
        sessionId,
        s.userId,
        s.userName || 'Unknown',
        s.score.toString()
      ]);

      if (values.length === 0) {
        return true; // Nothing to sync
      }

      // 4. Verify sheet access first
      let firstSheetName = 'Sheet1';
      try {
        const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        if (spreadsheetInfo.data.sheets && spreadsheetInfo.data.sheets.length > 0) {
          firstSheetName = spreadsheetInfo.data.sheets[0]?.properties?.title || 'Sheet1';
        }
      } catch (accessError: any) {
        console.error('GoogleSheetsService: Cannot access spreadsheet:', accessError.message);
        if (accessError.code === 404) {
          throw new Error(`Google Sheet not found. Please check the Sheet ID: ${sheetId}`);
        } else if (accessError.code === 403) {
          throw new Error(`Access denied (${accessError.message}). Did you check the 'Google Sheets' permission box during login? Is the sheet shared with your login email?`);
        } else {
          throw new Error(`Failed to access Google Sheet: ${accessError.message}`);
        }
      }

      // 4.5. Check if headers exist
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${firstSheetName}!A1:F1`
        });
        
        const rows = response.data.values;
        if (!rows || rows.length === 0 || !rows[0] || rows[0].length === 0 || !rows[0][0]) {
          values.unshift([
            "Timestamp", "Quiz Name", "Session ID", "User ID", "Participant", "Score"
          ]);
        }
      } catch (err: any) {
        console.warn('GoogleSheetsService: Could not read sheet to check headers', err.message);
      }

      // 5. Append to sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${firstSheetName}!A:F`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: values
        }
      });

      console.log(`Successfully synced ${scores.length} scores to Google Sheet ${sheetId}`);
      return true;

    } catch (error: any) {
      console.error('Failed to sync scores to Google Sheet:', error.message);
      throw error; // Re-throw to let the caller handle the specific error message
    }
  }
}
