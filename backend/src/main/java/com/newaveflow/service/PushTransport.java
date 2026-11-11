package com.newaveflow.service;
import com.newaveflow.entity.*;

/** Provider contract; implementations must never log device tokens or notification contents. */
public interface PushTransport {
    enum Result { SENT, RETRY, INVALID_DEVICE, FAILED, DISABLED }
    boolean available();
    default boolean available(String platform) { return available(); }
    Result send(PushDevice device, Notification notification);
}
