"""Deny new networking in the local embedding process after its loopback listener binds.
Uses the system libseccomp; failures are fatal. Install before native model imports so
subsequently created threads/children inherit the filter. This is Linux-only.
"""
import ctypes
import ctypes.util
import errno

def block_new_network_connections():
    path=ctypes.util.find_library('seccomp')
    if not path: raise RuntimeError('libseccomp required for isolated local inference')
    lib=ctypes.CDLL(path)
    lib.seccomp_init.argtypes=[ctypes.c_uint32];lib.seccomp_init.restype=ctypes.c_void_p
    lib.seccomp_syscall_resolve_name.argtypes=[ctypes.c_char_p];lib.seccomp_syscall_resolve_name.restype=ctypes.c_int
    lib.seccomp_rule_add.argtypes=[ctypes.c_void_p,ctypes.c_uint32,ctypes.c_int,ctypes.c_uint];lib.seccomp_rule_add.restype=ctypes.c_int
    lib.seccomp_load.argtypes=[ctypes.c_void_p];lib.seccomp_load.restype=ctypes.c_int
    lib.seccomp_release.argtypes=[ctypes.c_void_p]
    context=lib.seccomp_init(0x7fff0000) # SCMP_ACT_ALLOW
    if not context: raise RuntimeError('seccomp initialization failed')
    try:
        for name in [b'socket',b'socketpair',b'connect',b'io_uring_setup',b'pidfd_getfd']:
            number=lib.seccomp_syscall_resolve_name(name)
            if number<0 or lib.seccomp_rule_add(context,0x00050000|errno.EPERM,number,0):
                raise RuntimeError('seccomp network rule failed')
        if lib.seccomp_load(context): raise RuntimeError('seccomp load failed')
    finally:lib.seccomp_release(context)

if __name__=='__main__':
    import socket
    listener=socket.socket();listener.bind(('127.0.0.1',0));listener.listen()
    block_new_network_connections()
    try:socket.socket()
    except PermissionError:print('PASS: kernel denied creation of new network sockets')
    else:raise RuntimeError('network filter did not apply')
    listener.close()
