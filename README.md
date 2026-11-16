# LibrAY (web app)

A private library for two, installed on the iPhone from Safari. No App Store, no Mac, no account.
Books are stored on each phone; nothing is uploaded anywhere.

## 1. Put the folder online (once)

The app is five small files and must be served over https for the camera to work.
Any free static host does it. Two common ones:

- **Netlify Drop**: on a computer, sign in at app.netlify.com/drop and drag this whole folder onto the page. You get an address like `https://something.netlify.app`.
- **GitHub Pages**: create a public repository, upload the files in this folder, then turn on Pages under Settings > Pages (branch `main`, folder `/root`).

The address is public, but it only serves the empty app. Your books never leave your phone.

## 2. Install on each iPhone

1. Open the address in **Safari**.
2. Tap Share, then **Add to Home Screen**.
3. Open LibrAY from the Home Screen and enter your name.

Do the same on your partner's phone with the same address.

Removing the icon from the Home Screen deletes the books stored in it.

## Using it

- **Shelves**: Reading, To Read and Finished. Scroll up and down between them. Tap a spine to take the book out.
- **Add, scan a book**: tap +, then Scan a book, and hold the barcode on the back cover inside the frame. The barcode is the ISBN, which identifies the exact edition. Title, author, publisher, year, page count and cover come from Open Library, with Google Books as a second source. The first scan asks for camera permission.
- **Add, wish for a book**: tap +, then Wish for a book, and type the title. It stands on the To Read shelf as a pale outline. When you get the book, open it and tap "I have it now. Scan it".
- **Rate**: tap or slide across the stars, in half stars. Tap the same rating again to clear it.
- **Notes**: Add a note in the book view. Tap a note to edit or remove it.
- **Visit your partner's library**: in Mine, tap the share icon and AirDrop the file. Your partner saves it to Files, opens the Visit tab and chooses it. It is a snapshot; send a new one whenever you like.

## Syncing (optional)

With a Firebase project set in `firebase-config.js`, each person signs in once and both libraries stay up to date on both phones; the Visit tab shows the partner's shelves live. Access is limited to two email addresses by the Firestore security rules set in the Firebase console. With `window.LIBRAY_FIREBASE = null` the app works on its own, as before.

## Things to know

- Books are drawn at their real height and thickness when Open Library records them; otherwise thickness comes from the page count and height is a standard paperback.
- No catalogue offers photographs of book spines, so LibrAY scans them like a document: hold the book upright against a plain background and point the camera at the spine. It outlines the spine, takes the photo when you hold still, lets you drag any corner that is off, and straightens the image. The straightened photo also sets the book's thickness on the shelf. Without a photo the spine is drawn from the cover's colours.
- If the catalogue has no record for an ISBN, you can type the title and author and shelve it anyway.
- If the camera is refused, allow it under Settings > Safari > Camera, or type the ISBN.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app |
| `zxing.min.js` | Barcode reader (ZXing, Apache 2.0 licence). Safari has no built-in one. |
| `sync.js`, `firebase-config.js`, `firebase/` | Syncing through Firebase (Google's web SDK, Apache 2.0 licence) |
| `spine-scan.js` | Finds the spine's edges in the camera image and straightens the photo |
| `sw.js` | Lets the app open offline and keeps covers you have already seen |
| `manifest.webmanifest`, `icon-*.png` | Home Screen name and icon |
