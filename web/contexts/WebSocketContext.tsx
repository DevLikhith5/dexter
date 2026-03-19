import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
    socket: WebSocket | null;
    isConnected: boolean;
    subscribe: (callback: (message: any) => void) => () => void;
    sendMessage: (type: string, payload: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (!context) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { user } = useAuth();

    // Ref to keep track of the socket instance without triggering re-renders
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 1000;
    const listenersRef = useRef<Set<(message: any) => void>>(new Set());

    const subscribe = (callback: (message: any) => void) => {
        listenersRef.current.add(callback);
        return () => {
            listenersRef.current.delete(callback);
        };
    };

    const connect = () => {
        // Only connect if user is logged in
        // if (!user) return; 

        // For now, allow connection even if not logged in, or handle auth inside join
        // But typically we want a persistent connection.

        // Connect to WebSocket server
        // Assuming backend is on port 3001
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connected');
            setIsConnected(true);
            setSocket(ws);
            reconnectAttemptsRef.current = 0;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setIsConnected(false);
            setSocket(null);

            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
                reconnectAttemptsRef.current++;
                console.log(`Reconnecting in ${delay}ms (Attempt ${reconnectAttemptsRef.current})`);
                reconnectTimeoutRef.current = setTimeout(connect, delay);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                // console.log('WebSocket message received:', message);
                listenersRef.current.forEach(listener => listener(message));
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
    };

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.close();
            }
        };
    }, [user]); // Re-connect if user changes (optional)

    const sendMessage = (type: string, payload: any) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type, payload }));
        } else {
            console.warn('WebSocket not connected, cannot send message');
        }
    };

    return (
        <WebSocketContext.Provider value={{ socket, isConnected, sendMessage, subscribe }}>
            {children}
        </WebSocketContext.Provider>
    );
};
