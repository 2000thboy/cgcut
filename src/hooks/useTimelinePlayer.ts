import { useState, useCallback, useRef, useEffect } from 'react';
import type { Clip } from '../types/DataModel';
import type { UseTimelinePlayerProps } from './types';

export interface UseTimelinePlayerReturn {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  playbackRate: number;
  buffered: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  togglePlayPause: () => void;
  onTimeUpdate: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onLoadedMetadata: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEnded: () => void;
}

export function useTimelinePlayer({
  clips,
  onTimeUpdate,
  onClipSelect,
}: UseTimelinePlayerProps): UseTimelinePlayerReturn {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [buffered, setBuffered] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // 播放控制
  const play = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolumeControl = useCallback((vol: number) => {
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setVolume(vol);
    }
  }, []);

  const setPlaybackRateControl = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // 事件处理
  const handleTimeUpdate = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    setCurrentTime(video.currentTime);
    onTimeUpdate?.(video.currentTime);
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    setDuration(video.duration);
    setBuffered(true);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    // 自动切换到下一个clip
    const currentClipIndex = clips.findIndex(clip => clip.shot_id === videoRef.current?.src);
    if (currentClipIndex !== -1 && currentClipIndex < clips.length - 1) {
      const nextClip = clips[currentClipIndex + 1];
      if (videoRef.current) {
        videoRef.current.src = nextClip.shot_id;
        videoRef.current.play();
        setIsPlaying(true);
        onClipSelect?.(nextClip.id);
      }
    }
  }, [clips, onClipSelect]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, []);

  return {
    currentTime,
    duration,
    isPlaying,
    volume,
    playbackRate,
    buffered,
    videoRef,
    play,
    pause,
    seek,
    setVolume: setVolumeControl,
    setPlaybackRate: setPlaybackRateControl,
    togglePlayPause,
    onTimeUpdate: handleTimeUpdate,
    onLoadedMetadata: handleLoadedMetadata,
    onEnded: handleEnded,
  };
}