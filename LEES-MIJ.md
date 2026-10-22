# Onward laaddata

Maakt elke nacht een klein bestand `tariffs.json` met de prijzen van alle openbare laadpalen in
Nederland (± 0,6 MB). Je Onward-Worker geeft dat door aan de app, zodat je bij laadpalen de prijs
per kWh ziet. Alles gratis: GitHub draait de taak, de data is open data van NDW.

## Eenmalig instellen (± 15 minuten, makkelijkst op een computer)

1. Maak een gratis account op https://github.com (als je dat nog niet hebt).
2. Rechtsboven **+ → New repository**. Naam: `onward-laaddata`. Kies **Public** → **Create repository**.
3. Klik op **uploading an existing file** en sleep de inhoud van deze map erin
   (`build-tariffs.mjs`, `LEES-MIJ.md` en de map `.github`) → **Commit changes**.
   - De map `.github` is op een Mac verborgen. Druk in Finder op **Cmd+Shift+.** om hem te zien.
   - Lukt slepen niet: **Add file → Create new file**, typ als naam
     `.github/workflows/tariffs.yml` en plak de inhoud van dat bestand erin.
4. **Settings → Actions → General → Workflow permissions** → kies **Read and write permissions** → **Save**.
5. **Actions** → links **Laadpaaltarieven bijwerken** → **Run workflow** → **Run workflow**.
   Na ± 1 minuut staat er een groen vinkje, en in je repository een bestand `tariffs.json`.
6. Klik op `tariffs.json` → knop **Raw** → kopieer het adres uit de adresbalk. Dat ziet er zo uit:
   `https://raw.githubusercontent.com/<jouw-naam>/onward-laaddata/main/tariffs.json`
7. Zet dat adres in je Worker. Kies één van de twee:
   - **In de code:** Edit code → zoek `const TARIFFS_URL = '';` en zet het adres tussen de aanhalingstekens → **Deploy**.
   - **Zonder code:** je Worker → **Settings → Variables and Secrets → Add** → Type *Text*,
     naam `TARIFFS_URL`, waarde het adres → **Deploy**.
8. Controle: open `https://broad-firefly-d4be.rd78m7t5k2.workers.dev/status`. Bij `tarieven` hoort
   `status: 200` met een datum en een aantal te staan.

Daarna werkt het vanzelf: GitHub draait de taak elke nacht om ± 06:17.

## Goed om te weten

- Het is de **ad-hocprijs**: betalen met pinpas of QR aan de paal, inclusief btw. Met een laadpas kan
  je prijs anders zijn.
- Niet elke exploitant levert zijn tarieven aan. Een paal zonder prijs blijft gewoon in de lijst.
- Mislukt de taak een keer (bijvoorbeeld als NDW even plat ligt), dan blijft het bestand van de vorige
  nacht staan. GitHub stuurt je dan een mailtje.
