// send の間引き間隔
const SendThrottleInterval = 0.2; // (0.2sec = 5Hz)

let nextSendTime = 0;

_.onFrame(deltaTime => {
  // send の間引き (5Hz)
  nextSendTime += deltaTime;
  if (nextSendTime < SendThrottleInterval) {
    return;
  }
  nextSendTime -= SendThrottleInterval;

  let camRot = _.cameraHandle.getRotation();
  if (camRot == null) {
    return;
  }
  _.sendTo(_.sourceItemId, "update_camera_rotation", camRot);
  
});

_.onReceive((messageType, arg, sender) => {
  switch (messageType) {
    case "init_camera":
      _.cameraHandle.setRotation(arg);
      _.cameraHandle.setThirdPersonDistance(5);
      // 
      _.cameraHandle.setRotation(null);
      break;
    case "reset_camera":
      _.cameraHandle.setRotation(null);
      _.cameraHandle.setThirdPersonDistance(null);
      break;
  }
}, { player: false, item: true });
