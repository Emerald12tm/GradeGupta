import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Sharing helpers: everything goes through the phone's share sheet, so the user decides
 * where a file goes (Messages, Drive, Files…). Nothing is uploaded by the app itself.
 */

/** Renders HTML to a PDF and opens the share sheet. */
export async function sharePdf(html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share grade report' });
}

/** Shares an image file (e.g. a captured grade card). */
export async function shareImage(uri: string): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share' });
}

/** Writes text to a temporary file and opens the share sheet to save it. */
export async function shareTextFile(name: string, text: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save backup' });
}

/** Lets the user pick a JSON file and returns its text, or null if they cancel. */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  return new File(result.assets[0].uri).text();
}
