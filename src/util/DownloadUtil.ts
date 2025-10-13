export function downloadBlob(blob: Blob, filename = "battlemap.png") {
    // I hate that this janky method is required to download a blob,
    // but it is what it is
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
