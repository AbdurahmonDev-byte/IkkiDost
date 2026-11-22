//! Silent receipt printing straight to the receipt printer (no print dialog).
//!
//! The web page renders the receipt to a 1-bit bitmap (so any alphabet —
//! Latin, Cyrillic, Ғ Қ Ў Ҳ — prints exactly as on screen) and sends it here.
//! We wrap it in ESC/POS raster commands (`GS v 0`) and hand the bytes to the
//! printer as a RAW job: Windows spooler on Windows, CUPS `lp -o raw` elsewhere.
//! Xprinter and other 58/80 mm thermal printers understand ESC/POS.

use serde::Serialize;

#[derive(Serialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
}

/// ESC/POS job: init, raster image in bands, feed, partial cut.
pub fn escpos_raster(width_px: u32, height_px: u32, bits: &[u8]) -> Result<Vec<u8>, String> {
    let row_bytes = ((width_px + 7) / 8) as usize;
    if width_px == 0 || height_px == 0 || bits.len() != row_bytes * height_px as usize {
        return Err(format!(
            "Rasm o‘lchami noto‘g‘ri: {}x{}, {} bayt",
            width_px,
            height_px,
            bits.len()
        ));
    }
    let mut out = Vec::with_capacity(bits.len() + 64);
    out.extend_from_slice(&[0x1B, 0x40]); // ESC @ — initialise
    const BAND: usize = 128; // rows per GS v 0 command; small bands suit cheap printers
    let mut row = 0usize;
    while row < height_px as usize {
        let rows = BAND.min(height_px as usize - row);
        out.extend_from_slice(&[
            0x1D,
            0x76,
            0x30,
            0x00,
            (row_bytes & 0xFF) as u8,
            ((row_bytes >> 8) & 0xFF) as u8,
            (rows & 0xFF) as u8,
            ((rows >> 8) & 0xFF) as u8,
        ]);
        out.extend_from_slice(&bits[row * row_bytes..(row + rows) * row_bytes]);
        row += rows;
    }
    out.extend_from_slice(&[0x1B, 0x64, 0x04]); // ESC d 4 — feed 4 lines
    out.extend_from_slice(&[0x1D, 0x56, 0x42, 0x00]); // GS V B 0 — partial cut
    Ok(out)
}

#[cfg(windows)]
mod os {
    use super::PrinterInfo;
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, GetDefaultPrinterW, OpenPrinterW,
        StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ENUM_CONNECTIONS,
        PRINTER_ENUM_LOCAL, PRINTER_HANDLE, PRINTER_INFO_4W,
    };

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe fn from_wide(p: *const u16) -> String {
        if p.is_null() {
            return String::new();
        }
        let mut len = 0;
        while *p.add(len) != 0 {
            len += 1;
        }
        String::from_utf16_lossy(std::slice::from_raw_parts(p, len))
    }

    pub fn default_printer() -> Option<String> {
        unsafe {
            let mut size: u32 = 0;
            GetDefaultPrinterW(null_mut(), &mut size);
            if size == 0 {
                return None;
            }
            let mut buf = vec![0u16; size as usize];
            if GetDefaultPrinterW(buf.as_mut_ptr(), &mut size) == 0 {
                return None;
            }
            Some(from_wide(buf.as_ptr()))
        }
    }

    pub fn list() -> Result<Vec<PrinterInfo>, String> {
        let default = default_printer();
        unsafe {
            let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
            let mut needed: u32 = 0;
            let mut count: u32 = 0;
            EnumPrintersW(flags, null(), 4, null_mut(), 0, &mut needed, &mut count);
            if needed == 0 {
                return Ok(vec![]);
            }
            let mut buf = vec![0u8; needed as usize];
            if EnumPrintersW(flags, null(), 4, buf.as_mut_ptr(), needed, &mut needed, &mut count) == 0 {
                return Err("Printerlar ro‘yxatini olib bo‘lmadi".into());
            }
            let infos = std::slice::from_raw_parts(buf.as_ptr() as *const PRINTER_INFO_4W, count as usize);
            Ok(infos
                .iter()
                .map(|i| {
                    let name = from_wide(i.pPrinterName);
                    let is_default = default.as_deref() == Some(name.as_str());
                    PrinterInfo { name, is_default }
                })
                .collect())
        }
    }

    pub fn print_raw(printer: &str, data: &[u8]) -> Result<(), String> {
        unsafe {
            let name = wide(printer);
            let mut handle = PRINTER_HANDLE::default();
            if OpenPrinterW(name.as_ptr(), &mut handle, null()) == 0 {
                return Err(format!("“{}” printerini ochib bo‘lmadi", printer));
            }
            let doc_name = wide("Ikki Do'st chek");
            let datatype = wide("RAW");
            let doc = DOC_INFO_1W {
                pDocName: doc_name.as_ptr() as *mut u16,
                pOutputFile: null_mut(),
                pDatatype: datatype.as_ptr() as *mut u16,
            };
            let result = (|| {
                if StartDocPrinterW(handle, 1, &doc as *const DOC_INFO_1W) == 0 {
                    return Err("Chop etish ishini boshlab bo‘lmadi".to_string());
                }
                if StartPagePrinter(handle) == 0 {
                    EndDocPrinter(handle);
                    return Err("Sahifani boshlab bo‘lmadi".to_string());
                }
                let mut written: u32 = 0;
                let ok = WritePrinter(handle, data.as_ptr() as *const _, data.len() as u32, &mut written);
                EndPagePrinter(handle);
                EndDocPrinter(handle);
                if ok == 0 || written as usize != data.len() {
                    return Err("Printerga yozib bo‘lmadi".to_string());
                }
                Ok(())
            })();
            ClosePrinter(handle);
            result
        }
    }
}

#[cfg(not(windows))]
mod os {
    use super::PrinterInfo;
    use std::io::Write;
    use std::process::{Command, Stdio};

    pub fn list() -> Result<Vec<PrinterInfo>, String> {
        let default = Command::new("lpstat")
            .arg("-d")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .and_then(|s| s.split(':').nth(1).map(|v| v.trim().to_string()));
        let out = Command::new("lpstat")
            .arg("-e")
            .output()
            .map_err(|_| "CUPS (lpstat) topilmadi".to_string())?;
        Ok(String::from_utf8_lossy(&out.stdout)
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| PrinterInfo {
                name: l.trim().to_string(),
                is_default: default.as_deref() == Some(l.trim()),
            })
            .collect())
    }

    pub fn print_raw(printer: &str, data: &[u8]) -> Result<(), String> {
        let mut child = Command::new("lp")
            .args(["-d", printer, "-o", "raw"])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .spawn()
            .map_err(|_| "CUPS (lp) topilmadi".to_string())?;
        child
            .stdin
            .take()
            .ok_or("lp stdin yo‘q")?
            .write_all(data)
            .map_err(|e| e.to_string())?;
        let status = child.wait().map_err(|e| e.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("“{}” printeriga yuborib bo‘lmadi", printer))
        }
    }
}

#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    os::list()
}

/// `bits`: 1 bit per pixel, MSB first, 1 = black, rows padded to whole bytes.
#[tauri::command]
pub async fn print_receipt_raster(printer: String, width: u32, height: u32, bits: Vec<u8>) -> Result<(), String> {
    let job = escpos_raster(width, height, &bits)?;
    tauri::async_runtime::spawn_blocking(move || os::print_raw(&printer, &job))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::escpos_raster;

    #[test]
    fn raster_job_has_header_bands_and_cut() {
        let width = 16; // 2 bytes per row
        let height = 300;
        let bits = vec![0xFFu8; 2 * height];
        let job = escpos_raster(width, height as u32, &bits).unwrap();
        assert_eq!(&job[..2], &[0x1B, 0x40]);
        assert_eq!(&job[2..10], &[0x1D, 0x76, 0x30, 0x00, 2, 0, 128, 0]);
        assert_eq!(&job[job.len() - 4..], &[0x1D, 0x56, 0x42, 0x00]);
        // 3 bands (128 + 128 + 44 rows) → 3 headers of 8 bytes.
        assert_eq!(job.len(), 2 + 3 * 8 + bits.len() + 3 + 4);
    }

    #[test]
    fn rejects_wrong_size() {
        assert!(escpos_raster(16, 2, &[0u8; 3]).is_err());
    }
}
