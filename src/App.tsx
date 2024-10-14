import React, { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder, HubConnection } from '@microsoft/signalr';
import { MessageSquare, Send } from 'lucide-react';

interface Message {
  sender: string;
  text: string;
  time: Date;
}

const App: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [activeChats, setActiveChats] = useState<{ [userId: string]: string }>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loginAgent = async () => {
    try {
      const response = await fetch('https://10.0.0.154:5143/api/account/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ Username: username, Password: password })
      });
      if (response.ok) {
        const data = await response.json();
        await loginAgentSignalR(username, password, data.token);
      } else {
        alert("Login failed.");
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert("Failed to fetch. Please check the console for more details.");
    }
  };

  const loginAgentSignalR = async (username: string, password: string, token: string) => {
    const newConnection = new HubConnectionBuilder()
      .withUrl("https://10.0.0.154:5143/chatHub", {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    newConnection.on("IncommingMessage", (message: string, sendername: string) => {
      setMessages(prev => [...prev, { sender: sendername, text: message, time: new Date() }]);
      playNotificationSound();
    });

    newConnection.on("ChatRequest", (userName: string, chatType: string) => {
      setActiveChats(prev => ({ ...prev, [userName]: chatType }));
      playNotificationSound();
    });

    newConnection.on("UserDisconnected", (userId: string) => {
      setActiveChats(prev => {
        const newActiveChats = { ...prev };
        delete newActiveChats[userId];
        return newActiveChats;
      });
    });

    try {
      await newConnection.start();
      await newConnection.invoke("AgentLogin", username, password, ["general", "support"]);
      setConnection(newConnection);
      setUsername(username);
      setIsChatOpen(true);
    } catch (err) {
      console.error("Error establishing SignalR connection:", err);
    }
  };

  const sendMessage = async () => {
    if (inputMessage.trim() && connection && currentUserId) {
      try {
        await connection.invoke("SendMessageToUser", currentUserId, inputMessage);
        setMessages(prev => [...prev, { sender: username, text: inputMessage, time: new Date() }]);
        setInputMessage('');
      } catch (err) {
        console.error("Error sending message:", err);
      }
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      sendMessage();
    }
  };

  const pickupChat = async (userId: string, chatType: string) => {
    if (connection) {
      try {
        await connection.invoke("PickupChat", userId, chatType);
        setCurrentUserId(userId);
      } catch (err) {
        console.error("Error picking up chat:", err);
      }
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.play();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-md p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Agent Chat Application</h1>
          {!username && (
            <div className="flex space-x-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="border rounded p-2"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="border rounded p-2"
              />
              <button
                onClick={loginAgent}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
              >
                Login
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 flex">
        <div className="w-1/4 bg-white shadow-md rounded-lg p-4 mr-4">
          <h2 className="text-xl font-semibold mb-4">Active Chats</h2>
          {Object.entries(activeChats).map(([userId, chatType]) => (
            <div
              key={userId}
              className="p-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => pickupChat(userId, chatType)}
            >
              {userId} - {chatType}
            </div>
          ))}
        </div>
        <div className="flex-grow bg-white shadow-md rounded-lg p-4">
          <div className="h-[400px] overflow-y-auto mb-4">
            {messages.map((msg, index) => (
              <div key={index} className={`mb-2 ${msg.sender === username ? 'text-right' : 'text-left'}`}>
                <span className="text-xs text-gray-500">{msg.sender}</span>
                <p className={`inline-block p-2 rounded-lg ${msg.sender === username ? 'bg-blue-100' : 'bg-gray-200'}`}>
                  {msg.text}
                </p>
                <span className="text-xs text-gray-500 block">{msg.time.toLocaleTimeString()}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-grow border rounded-l-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={sendMessage}
              className="bg-blue-500 text-white p-2 rounded-r-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;