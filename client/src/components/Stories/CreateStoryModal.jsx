import { useState, useRef } from 'react';
import { X, Image as ImageIcon, Video as VideoIcon, Type, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useUIStore from '../../store/uiStore';
import api from '../../api';

const GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
];

function CreateStoryModal() {
  const { activeModal, closeModal } = useUIStore();
  const [tab, setTab] = useState('photo'); // 'photo' | 'video' | 'text'
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [text, setText] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isOpen = activeModal === 'createStory';

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handlePublishMedia = async () => {
    if (!file) return;

    setUploading(true);
    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const { url } = uploadResponse.data;

      // Create story
      await api.post('/stories', {
        type: tab === 'photo' ? 'image' : 'video',
        file_url: url
      });

      closeModal();
      // TODO: Refresh stories
      window.location.reload();
    } catch (error) {
      console.error('Failed to publish story:', error);
      alert('Failed to publish story');
    } finally {
      setUploading(false);
    }
  };

  const handlePublishText = async () => {
    if (!text.trim()) return;

    setUploading(true);
    try {
      await api.post('/stories', {
        type: 'text',
        content: text,
        background_color: selectedGradient
      });

      closeModal();
      // TODO: Refresh stories
      window.location.reload();
    } catch (error) {
      console.error('Failed to publish story:', error);
      alert('Failed to publish story');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Create Story</h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setTab('photo')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  tab === 'photo'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                Photo
              </button>
              <button
                onClick={() => setTab('video')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  tab === 'video'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <VideoIcon className="w-4 h-4" />
                Video
              </button>
              <button
                onClick={() => setTab('text')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  tab === 'text'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Type className="w-4 h-4" />
                Text
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {(tab === 'photo' || tab === 'video') && (
              <div>
                {!preview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-colors"
                  >
                    <div className="text-6xl mb-4">
                      {tab === 'photo' ? '📷' : '🎥'}
                    </div>
                    <p className="text-gray-400 mb-2">
                      Click to select {tab === 'photo' ? 'photo' : 'video'}
                    </p>
                    <p className="text-sm text-gray-500">
                      or drag and drop here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden bg-black">
                      {tab === 'photo' ? (
                        <img src={preview} alt="Preview" className="w-full max-h-96 object-contain" />
                      ) : (
                        <video src={preview} controls className="w-full max-h-96" />
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                      }}
                      className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
                    >
                      Change {tab === 'photo' ? 'Photo' : 'Video'}
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={tab === 'photo' ? 'image/*' : 'video/*'}
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {tab === 'text' && (
              <div className="space-y-4">
                {/* Preview */}
                <div
                  className="w-full h-96 rounded-lg flex items-center justify-center p-8"
                  style={{ background: selectedGradient }}
                >
                  <p className="text-white text-3xl font-bold text-center break-words">
                    {text || 'Your text here...'}
                  </p>
                </div>

                {/* Text input */}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter your text..."
                  maxLength={200}
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                />

                <div className="text-right text-sm text-gray-400">
                  {text.length}/200
                </div>

                {/* Background selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Background
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {GRADIENTS.map((gradient, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedGradient(gradient)}
                        className={`w-full h-12 rounded-lg transition-all ${
                          selectedGradient === gradient
                            ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-800'
                            : ''
                        }`}
                        style={{ background: gradient }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-700">
            <button
              onClick={tab === 'text' ? handlePublishText : handlePublishMedia}
              disabled={uploading || (tab === 'text' ? !text.trim() : !file)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Publishing...
                </>
              ) : (
                'Publish Story'
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default CreateStoryModal;
