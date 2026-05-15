import NewChatModal from './NewChatModal';
import CreateStoryModal from '../Stories/CreateStoryModal';
import ProfileModal from './ProfileModal';
import SettingsModal from '../Settings/SettingsModal';

function Modals() {
  return (
    <>
      <NewChatModal />
      <CreateStoryModal />
      <ProfileModal />
      <SettingsModal />
      {/* Other modals will be added here */}
    </>
  );
}

export default Modals;
