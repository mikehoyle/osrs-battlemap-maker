import { useEffect, useState } from "react";
import WebFont from "webfontloader";

import { OsrsLoadingBar } from "../components/rs/loading/OsrsLoadingBar";
import { DownloadProgress } from "../rs/cache/CacheFiles";
import { formatBytes } from "../util/BytesUtil";
import { isIos } from "../util/DeviceUtil";
import { fetchCacheList, loadCacheFiles } from "../mapviewer/Caches";
import { TokenMaker } from "../tokenmaker/TokenMaker";
import { TokenMakerContainer } from "../tokenmaker/TokenMakerContainer";
import "./TokenMakerPage.css";

WebFont.load({
    custom: {
        families: ["OSRS Bold", "OSRS Small"],
    },
});

const cachesPromise = fetchCacheList();

export function TokenMakerPage() {
    const [errorMessage, setErrorMessage] = useState<string>();
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>();
    const [tokenMaker, setTokenMaker] = useState<TokenMaker>();

    useEffect(() => {
        const abortController = new AbortController();

        const load = async () => {
            const cacheList = await cachesPromise;
            if (!cacheList) {
                setErrorMessage("Failed to load cache list");
                throw new Error("No caches found");
            }

            const cache = await loadCacheFiles(
                cacheList.latest,
                abortController.signal,
                setDownloadProgress,
            );

            const tokenMaker = new TokenMaker(cacheList, cache);
            await tokenMaker.init();

            setDownloadProgress(undefined);
            setTokenMaker(tokenMaker);
        };

        if (isIos) {
            setErrorMessage("iOS is not supported.");
        } else {
            load().catch((err) => {
                console.error(err);
                setErrorMessage("Failed to load: " + err.message);
            });
        }

        return () => {
            abortController.abort();
        };
    }, []);

    let content: JSX.Element | undefined;
    if (errorMessage) {
        content = <div className="center-container max-height content-text">{errorMessage}</div>;
    } else if (downloadProgress) {
        const formattedCacheSize = formatBytes(downloadProgress.total);
        const progress = ((downloadProgress.current / downloadProgress.total) * 100) | 0;
        content = (
            <div className="center-container max-height">
                <OsrsLoadingBar
                    text={`Downloading cache (${formattedCacheSize})`}
                    progress={progress}
                />
            </div>
        );
    } else if (tokenMaker) {
        content = <TokenMakerContainer tokenMaker={tokenMaker} />;
    }

    return <div className="token-maker-page max-height">{content}</div>;
}
