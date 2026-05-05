import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Download, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WaveAudioPlayerProps {
  url: string;
  height?: number;
  /** When provided, the browser saves the downloaded file with this name. */
  downloadName?: string;
}

export function WaveAudioPlayer({ url, height = 60, downloadName }: WaveAudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !url) return;

    setLoading(true);
    setError(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#a78bfa',
      progressColor: '#c4b5fd',
      height,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorWidth: 1,
      cursorColor: '#7c3aed',
      url,
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      setLoading(false);
      setDuration(ws.getDuration());
    });

    ws.on('error', () => {
      setLoading(false);
      setError(true);
    });

    ws.on('audioprocess', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('play', () => setPlaying(true));
    ws.on('pause', () => setPlaying(false));
    ws.on('finish', () => {
      setPlaying(false);
      setCurrentTime(ws.getDuration());
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [url, height]);

  function togglePlay() {
    wsRef.current?.playPause();
  }

  function fmt(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>Không thể tải file ghi âm</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full rounded-md overflow-hidden bg-muted/30" />
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={togglePlay}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {fmt(currentTime)} / {fmt(duration)}
        </span>
        <div className="flex-1" />
        <a href={url} download={downloadName ?? ''}>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Tải về">
            <Download className="h-4 w-4" />
          </Button>
        </a>
      </div>
    </div>
  );
}
