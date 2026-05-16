import { useContext } from 'react';
import { SocketContext } from '../context/SocketContextValue';

const useSocket = () => {
  return useContext(SocketContext);
};

export default useSocket;
