# Gold Hunter V7.1 Connector Status Layer

- Adds retry handling for BLS and FRED requests.
- Reports connector states as Live, Cached, or Offline.
- Shows each connector's last successful sync time.
- Hides raw DNS/HTTPS/Python error messages from Admin.
- Uses cached official values whenever a live source is temporarily unavailable.
- Does not modify Calendar, forecasts, Previous, Actual, Last Release, history, or news IDs.
