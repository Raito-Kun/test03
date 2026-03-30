import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface WaveformPlayerProps {
  src: string;
  onTimeClick?: (time: number) => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function WaveformPlayer({ src, onTimeClick }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState('1');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'hsl(var(--muted-foreground))',
      progressColor: 'hsl(var(--primary))',
      height: 60,
      normalize: true,
      interact: true,
    });

    ws.load(src);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      setReady(true);
    });

    ws.on('timeupdate', (t) => {
      setCurrentTime(t);
    });

    ws.on('play', () => setPlaying(true));
    ws.on('pause', () => setPlaying(false));
    ws.on('finish', () => setPlaying(false));

    ws.on('interaction', (newTime: number) => {
      onTimeClick?.(newTime);
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [src]);

  function togglePlay() {
    wavesurferRef.current?.playPause();
  }

  function skip(seconds: number) {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const next = Math.max(0, Math.min(ws.getCurrentTime() + seconds, ws.getDuration()));
    ws.setTime(next);
  }

  function handleSpeedChange(v: string) {
    setSpeed(v);
    wavesurferRef.current?.setPlaybackRate(Number(v));
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      {/* Waveform */}
      <div ref={containerRef} className={ready ? '' : 'opacity-50'} />

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skip(-15)} disabled={!ready}>
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay} disabled={!ready}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => skip(15)} disabled={!ready}>
          <SkipForward className="h-4 w-4" />
        </Button>

        <span className="flex-1 text-center text-xs text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <Select value={speed} onValueChange={(v) => { if (v) handleSpeedChange(v); }}>
          <SelectTrigger className="h-7 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {['0.5', '0.75', '1', '1.25', '1.5', '2'].map((s) => (
              <SelectItem key={s} value={s}>{s}x</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
