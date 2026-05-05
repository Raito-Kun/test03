import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
}

/** HTML5 audio player with speed control (no custom waveform per deferral) */
export function AudioPlayer({ src }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('1');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  }

  function handleSpeedChange(v: string) {
    setSpeed(v);
    if (audioRef.current) audioRef.current.playbackRate = Number(v);
  }

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Progress bar — track + filled + custom thumb via range overlay */}
      <div className="relative h-1.5 w-full">
        <div className="absolute inset-0 rounded-full bg-muted" />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.01}
          value={currentTime}
          onChange={(e) => {
            const t = Number(e.target.value);
            setCurrentTime(t);
            if (audioRef.current) audioRef.current.currentTime = t;
          }}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent accent-primary
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-card
            [&::-webkit-slider-thumb]:shadow
            [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-card [&::-moz-range-thumb]:bg-primary"
        />
      </div>

      {/* Time row — current/duration tabular numbers */}
      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls row — primary play button + speed selector */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="default"
          size="icon"
          className="h-9 w-9 rounded-full shadow-sm"
          onClick={togglePlay}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>

        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Tốc độ</span>
          <Select value={speed} onValueChange={(v) => { if (v) handleSpeedChange(v); }}>
            <SelectTrigger className="h-7 w-[68px] text-xs">
              <span>{speed}x</span>
            </SelectTrigger>
            <SelectContent>
              {['0.5', '0.75', '1', '1.25', '1.5', '2'].map((s) => (
                <SelectItem key={s} value={s}>{s}x</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
