
import ChatContainer from '@/components/chat/ChatContainer';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
    return (
        <div className="h-[calc(100vh-120px)] lg:h-[calc(100vh-64px)] -m-4 lg:-m-8">
            <ChatContainer />
        </div>
    );
}
