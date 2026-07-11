Gold Hunter V6.3 Workflow Duplicate Cleanup Fix

- Cleanup duplicate news now merges duplicate rows and writes the clean list back to Cloudflare KV.
- The most complete row wins; blank fields are filled from the duplicate copy.
- History and Last Release data are preserved during merging.
- Connector health reports duplicate/missing-Previous warnings without failing red.
- Cleanup verifies the live API after saving.
- Requires GitHub Actions secret ADMIN_PIN matching Cloudflare ADMIN_PIN.
