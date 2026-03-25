import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

  return (
    <div className="flex items-center gap-3 rounded-md border p-2">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <input
        type="range"
        min={0}
        max={duration || 0}
        value={currentTime}
        onChange={(e) => {
          const t = Number(e.target.value);
          setCurrentTime(t);
          if (audioRef.current) audioRef.current.currentTime = t;
        }}
        className="flex-1 accent-primary"
      />

      <span className="min-w-[4rem] text-xs text-muted-foreground">
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
