import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatBubbleLeftRightIcon, XMarkIcon, PaperAirplaneIcon, SparklesIcon } from './Icons';
import { cn } from '../lib/utils';
import Button from './Button';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
};

const ChatBot: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', content: 'Hello! I am your Dexter AI assistant. How can I help you today?' },
    ]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const toggleChat = () => setIsOpen(!isOpen);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: inputValue,
        };

        setMessages((prev) => [...prev, newMessage]);
        setInputValue('');

        // Simulate AI response
        setTimeout(() => {
            const responseMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "That's a great question! I'm just a demo bot right now, but soon I'll be able to help you create quizzes, analyze results, and more.",
            };
            setMessages((prev) => [...prev, responseMessage]);
        }, 1000);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="pointer-events-auto mb-4 w-[350px] md:w-[380px] h-[500px] max-h-[80vh] bg-white dark:bg-[#0A0A0A] backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10 bg-[#F4F4F5] dark:bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-black dark:bg-white flex items-center justify-center shadow-md">
                                    <SparklesIcon className="w-4 h-4 text-white dark:text-black" />
                                </div>
                                <h3 className="font-bold text-sm text-gray-900 dark:text-white font-heading">Dexter AI</h3>
                            </div>
                            <button
                                onClick={toggleChat}
                                className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-white dark:bg-[#0A0A0A]">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex flex-col max-w-[85%] space-y-1",
                                        msg.role === 'user' ? "self-end items-end ml-auto" : "self-start items-start"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "p-3 rounded-2xl text-sm font-medium shadow-sm",
                                            msg.role === 'user'
                                                ? "bg-black dark:bg-white text-white dark:text-black rounded-br-none"
                                                : "bg-[#F4F4F5] dark:bg-white/10 text-gray-900 dark:text-gray-100 rounded-bl-none"
                                        )}
                                    >
                                        {msg.content}
                                    </div>
                                    <span className="text-[10px] text-gray-400 px-1">
                                        {msg.role === 'assistant' ? 'AI' : 'You'} • Just now
                                    </span>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 dark:border-white/10 bg-[#F4F4F5] dark:bg-white/5">
                            <div className="relative flex items-center gap-2">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Ask me anything..."
                                    className="flex-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-black dark:focus:border-white focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 rounded-xl px-4 py-2.5 text-sm outline-none text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-all font-medium"
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    className={cn(
                                        "h-10 w-10 rounded-xl shrink-0 transition-all duration-200 bg-black dark:bg-white text-white dark:text-black",
                                        inputValue.trim()
                                            ? "shadow-lg hover:shadow-xl hover:scale-105"
                                            : "opacity-50 cursor-not-allowed shadow-none"
                                    )}
                                    disabled={!inputValue.trim()}
                                >
                                    <PaperAirplaneIcon className="w-5 h-5 -ml-0.5 mt-0.5 transform -rotate-45" />
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleChat}
                className="pointer-events-auto group relative flex items-center justify-center w-14 h-14 rounded-full bg-black dark:bg-white text-white dark:text-black shadow-2xl hover:shadow-2xl hover:shadow-black/40 dark:hover:shadow-white/30 transition-all duration-300 z-50"
            >
                <span className="absolute inset-0 rounded-full bg-black/20 dark:bg-white/20 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300"></span>
                <AnimatePresence mode='wait'>
                    {isOpen ? (
                        <motion.div
                            key="close"
                            initial={{ opacity: 0, rotate: -90 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: 90 }}
                            transition={{ duration: 0.2 }}
                            className="relative z-10"
                        >
                            <XMarkIcon className="w-7 h-7" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="chat"
                            initial={{ opacity: 0, rotate: 90 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: -90 }}
                            transition={{ duration: 0.2 }}
                            className="relative z-10"
                        >
                            <ChatBubbleLeftRightIcon className="w-7 h-7" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
};

export default ChatBot;
