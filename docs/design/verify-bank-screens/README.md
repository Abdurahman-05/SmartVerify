# Verify payment: bank → receipt → check (8 screens, 390x844)

Open each `.dc.html` in a browser as a visual reference only (markup is plain HTML/inline styles). Do not copy the HTML; rebuild with NativeWind and the existing theme tokens, MoneyText, i18n (en/am).

## Flow (Restaurant Plus, Cash + Bank / Bank only)
Verify Payment button "Check payment · 600 ETB"
→ 0a VerifyPickBank (step 1 Bank)
   - tap CBE / Telebirr / other listed bank → 0c or 0d (step 2 Receipt)
   - tap "Other bank" → 0b VerifyBankNotSupported (sheet): "Choose another bank" | "Save as not checked"
→ 0c VerifyNeedsCBE / 0d VerifyNeedsTelebirr: shows receipt picture + what to find
   - "Scan the QR" → 1a VerifyScanQR
   - "Read from a screenshot" → 2 VerifyReadReceipt
→ 1a: camera QR scan; "No QR? Read the receipt" → 2. QR not decoded → 1b VerifyQRNotFound (sheet): "Read the receipt" | "Scan again"
→ 2: "Take a photo" | "Choose a screenshot" → OCR → 3
→ 3 VerifyReceiptFound: found values shown with check; missing value = amber input; "Check · 600 ETB" disabled until all required fields filled; "Read again" → 2
→ existing Loading: checking payment → existing Fully paid / Not fully paid screens.

## Per-bank required fields (config, not hard-coded in screens)
| Bank | code | fields |
|---|---|---|
| Commercial Bank of Ethiopia | CBE | Reference No (transaction id), Payer account last 8 digits |
| Telebirr | TB | Transaction number |
Other banks in the list (Dashen, Abyssinia, Awash, Zemen, M-Pesa, CBE Birr, Wegagen) are placeholders: replace with the real 9 supported banks and their fields. Keep one `BANKS` config: { code, name, logo, fields[], urlPattern }. Screens 0c/0d/3 render from fields[].

## Notes
- Bank logo boxes show initials as placeholders; swap in logo files.
- QR gives all fields at once; OCR may miss some → screen 3 asks only for missing ones.
- Big touch targets (>=44, main buttons 60-68), icon + word status, no emoji.
