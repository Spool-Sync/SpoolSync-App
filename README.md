# SpoolSync

**SpoolSync** is an advanced, user-friendly filament management platform for 3D printing enthusiasts and print farms. It provides real-time tracking, inventory management, and seamless integration with printers and hardware, all in a self-hosted, privacy-first package.

---

## Key Features

- **Live Weight Tracking:**
  - ESP32-based load cells report spool weights in real time over Wi-Fi.
  - Instantly see filament usage as your printer runs.

- **NFC Tag Scanning:**
  - Tap a spool with your phone to view details or start the ingest flow.
  - Supports OpenPrintTag, Bambu, and serial tags.

- **Printer Integration:**
  - Polls PrusaLink and PrusaConnect[Work In Progress] for live print job status.
  - Automatically deducts filament when a job completes.

- **Storage Locations:**
  - Organize spools into drying chambers, long-term storage, or open shelves.
  - Always know where every spool is stored.

- **Smart Inventory Alerts:**
  - Set reorder thresholds per filament.
  - Get notified when a spool drops below the minimum.

- **Self-Hosted & Private:**
  - Deploy with Docker Compose.
  - No subscriptions, no cloud lock-in, no telemetry.

---

## Architecture

- **Backend:** Node.js (Express), Prisma ORM, Socket.IO for real-time updates
- **Frontend:** Vue.js (Vuetify UI)
- **Firmware:** ESP32 (C++/Arduino) for load cell and NFC-enabled spool holders
- **Integrations:** Modular JSON-based printer integrations (e.g., PrusaConnect)

---

## Getting Started

1. **Clone the repository:**
   ```sh
   git clone git@github.com:Spool-Sync/SpoolSync-App.git
   cd SpoolSync-App
   ```
2. **Configure environment variables:**

- Copy `.env.example` to `.env` and edit as needed. (Do not commit `.env` to git.)

3. **Start with Docker Compose:**
   ```sh
   docker-compose up --build
   ```
4. **Access the web UI:**
   - Visit `http://localhost:8080` (or your configured port)

---

## Project Structure

- `backend/` — Node.js API, integrations, database
- `frontend/` — Vue.js SPA

---

## Documentation

- **API:** See `backend/prisma/schema.prisma` and backend source
- **Integrations:** See `backend/integrations/printers/` for JSON config examples

---

## License

This project is licensed under the terms of the LICENSE file in this repository.

---

## Contributing

Pull requests and issues are welcome! See CONTRIBUTING.md (if available) or open an issue to get started.

---

## Credits

- Inspired by Spoolman and the Open Print Tag project
