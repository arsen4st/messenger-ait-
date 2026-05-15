import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import useUIStore from '../../store/uiStore';
import StoryViewer from '../Stories/StoryViewer';
import api from '../../api';

function StoriesStrip() {
  const { user } = useAuthStore();
  const { setModal } = useUIStore();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);

  useEffect(() => { loadStories(); }, []);

  const loadStories = async () => {
    try {
      const res = await api.get('/stories');
      setStories(res.data.stories || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const hasOwnStory = stories.some((s) => s.user.id === user.id);
  const otherStories = stories.filter((s) => s.user.id !== user.id);

  return (
    <div className="border border-fg-dim bg-card/40 px-2 py-1.5 relative">
      <span className="absolute -top-[10px] left-3 bg-bg px-1.5 text-[11px] text-fg-dim tracking-widest uppercase">
        stories
      </span>

      <div className="flex gap-1 overflow-x-auto scrollbar-none text-xs">
        {/* Add/own story */}
        <button
          onClick={() => {
            if (hasOwnStory) {
              setViewerStartIndex(stories.findIndex((s) => s.user.id === user.id));
              setViewerOpen(true);
            } else {
              setModal('createStory');
            }
          }}
          className="flex-shrink-0 px-2 py-1 border border-fg-dim bg-card/50 hover:border-fg hover:text-fg transition-colors min-w-[60px] text-center"
        >
          <div className="text-warn">{hasOwnStory ? '◉' : '+'}</div>
          <div className="text-[10px] truncate">{hasOwnStory ? 'you' : 'new'}</div>
        </button>

        {loading ? (
          <div className="text-muted text-[10px] px-2 py-1">loading...</div>
        ) : (
          otherStories.map((g, idx) => {
            const hasUnviewed = g.stories.some((s) => !s.viewed);
            return (
              <button
                key={g.user.id}
                onClick={() => {
                  setViewerStartIndex(idx + (hasOwnStory ? 1 : 0));
                  setViewerOpen(true);
                }}
                className={`flex-shrink-0 px-2 py-1 border min-w-[60px] text-center transition-colors ${
                  hasUnviewed
                    ? 'border-fg text-fg glow hover:bg-fg/10'
                    : 'border-fg-dim text-fg-dim hover:border-info'
                }`}
              >
                <div>{hasUnviewed ? '◉' : '○'}</div>
                <div className="text-[10px] truncate">{g.user.display_name.split(' ')[0]}</div>
              </button>
            );
          })
        )}
      </div>

      {viewerOpen && stories.length > 0 && (
        <StoryViewer
          stories={stories}
          initialUserIndex={viewerStartIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}

export default StoriesStrip;
