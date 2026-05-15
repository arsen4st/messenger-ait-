import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../../api';

function StoryViewer({ stories, initialUserIndex = 0, onClose }) {
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const progressIntervalRef = useRef(null);
  const videoRef = useRef(null);

  const currentUserStories = stories[currentUserIndex];
  const currentStory = currentUserStories?.stories[currentStoryIndex];

  useEffect(() => {
    if (!currentStory || isPaused) return;

    const duration = currentStory.type === 'video' ? 15000 : 5000; // 15s for video, 5s for image/text
    const interval = 50;
    const increment = (interval / duration) * 100;

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextStory();
          return 0;
        }
        return prev + increment;
      });
    }, interval);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [currentStory, isPaused, currentUserIndex, currentStoryIndex]);

  useEffect(() => {
    // Mark story as viewed
    if (currentStory) {
      api.post(`/stories/${currentStory.id}/view`).catch(console.error);
    }
  }, [currentStory?.id]);

  useEffect(() => {
    // Reset progress when story changes
    setProgress(0);
  }, [currentStoryIndex, currentUserIndex]);

  const nextStory = () => {
    if (currentStoryIndex < currentUserStories.stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else if (currentUserIndex < stories.length - 1) {
      setCurrentUserIndex(currentUserIndex + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  };

  const previousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    } else if (currentUserIndex > 0) {
      setCurrentUserIndex(currentUserIndex - 1);
      const prevUserStories = stories[currentUserIndex - 1];
      setCurrentStoryIndex(prevUserStories.stories.length - 1);
    }
  };

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width / 2) {
      previousStory();
    } else {
      nextStory();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      previousStory();
    } else if (e.key === 'ArrowRight') {
      nextStory();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUserIndex, currentStoryIndex]);

  const getFileUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return url;
  };

  const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    return avatar;
  };

  if (!currentUserStories || !currentStory) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Progress bars */}
        <div className="absolute top-4 left-0 right-0 px-4 z-10">
          <div className="max-w-md mx-auto flex gap-1">
            {currentUserStories.stories.map((_, index) => (
              <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all"
                  style={{
                    width: index < currentStoryIndex ? '100%' : index === currentStoryIndex ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="absolute top-8 left-0 right-0 px-4 z-10">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white overflow-hidden">
                {currentUserStories.user.avatar ? (
                  <img
                    src={getAvatarUrl(currentUserStories.user.avatar)}
                    alt={currentUserStories.user.display_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{currentUserStories.user.emoji_avatar || currentUserStories.user.display_name[0]}</span>
                )}
              </div>
              <div>
                <div className="text-white font-medium">{currentUserStories.user.display_name}</div>
                <div className="text-white/70 text-sm">
                  {formatDistanceToNow(new Date(currentStory.created_at * 1000), { addSuffix: true })}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="max-w-md w-full h-full flex items-center justify-center cursor-pointer"
          onClick={handleClick}
        >
          {currentStory.type === 'image' && (
            <img
              src={getFileUrl(currentStory.file_url)}
              alt="Story"
              className="max-w-full max-h-full object-contain"
            />
          )}

          {currentStory.type === 'video' && (
            <video
              ref={videoRef}
              src={getFileUrl(currentStory.file_url)}
              autoPlay
              muted
              playsInline
              className="max-w-full max-h-full object-contain"
              onEnded={nextStory}
            />
          )}

          {currentStory.type === 'text' && (
            <div
              className="w-full h-full flex items-center justify-center p-8"
              style={{
                background: currentStory.background_color || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}
            >
              <p className="text-white text-3xl font-bold text-center break-words">
                {currentStory.content}
              </p>
            </div>
          )}
        </div>

        {/* Navigation arrows (desktop) */}
        {currentUserIndex > 0 && (
          <button
            onClick={previousStory}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors hidden md:block"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>
        )}

        {(currentStoryIndex < currentUserStories.stories.length - 1 || currentUserIndex < stories.length - 1) && (
          <button
            onClick={nextStory}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors hidden md:block"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export default StoryViewer;
