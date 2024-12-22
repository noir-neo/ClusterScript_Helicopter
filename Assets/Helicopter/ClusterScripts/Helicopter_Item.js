const Vector2Zero = new Vector2(0, 0);
const Vector3Zero = new Vector3(0, 0, 0);
const Vector3Forward = new Vector3(0, 0, 1);
const Vector3Up = new Vector3(0, 1, 0);
const Vector3Right = new Vector3(1, 0, 0);
const QuaternionIdentity = new Quaternion(0, 0, 0, 1);
const gravity = -9.81;

// 質量 (Rigidbody の Mass と同じ値にする)
// @field(float)
const mass = 1;
// 抗力
// @field(float)
const drag = 1;
// 角抗力
// @field(float)
const angularDrag = 1;
// 上昇力
// @field(float)
const power = 1;
// トルク
// @field(float)
const torquePower = 1;
// 上昇力が入力に追従するフィルタ係数
// @field(float)
const powerFilterFactor = 0.6;

// @field(AudioClip)
const rotorSound = $.audio("Rotor");
// @field(float)
const rotorSoundVolumeFactor = 0.5;
// @field(float)
const rotorSoundVolumeOffset = 2;

// @field(string), @textArea
const rotorSubNodeNames = "RotorFrontLeft\nRotorFrontRight\nRotorRearLeft\nRotorRearRight";
// @field(float)
const rotorAnimationSpeedFactor = 200;
// @field(float)
const rotorAnimationSpeedOffset = 500;

const rotorSubNodes = rotorSubNodeNames.split('\n').map((x) => $.subNode(x));

const lerp = (a, b, t) => {
  return a + (b - a) * t;
};

// 現在の回転から目標の回転までのトルクを計算する
const calcTorque = (from, to) => {
  let q = to.clone().multiply(from.clone().invert());
  
  // w が負の場合は回転が 180 度以上
  // 距離が短くなるように反転させる
  if (q.w < 0)
  {
      q.x = -q.x;
      q.y = -q.y;
      q.z = -q.z;
      q.w = -q.w;
  }

  let torque = new Vector3(q.x, q.y, q.z);
  return torque;
};

$.onStart(() => {
  rotorSound.volume = rotorSoundVolumeOffset;
  rotorSound.play();
});

$.onRide((isGetOn, player) => {
  if (isGetOn) {
    $.setPlayerScript(player);
    player.send("init_camera", $.getRotation());
    $.state.ridingPlayer = player;
  } else {
    player.send("reset_camera", null);
    $.state.ridingPlayer = null;
  }
});

$.onSteer((input, player) => {
  // state に steer 入力を格納する
  $.state.steerInput = input;
});

$.onUpdate(deltaTime => {
  let ridingPlayer = $.state.ridingPlayer ?? null;
  let isRiding = ridingPlayer !== null && ridingPlayer.exists();

  let steerInput = $.state.steerInput ?? Vector2Zero;

  let force = Vector3Zero;
  let torque = Vector3Zero;

  if (isRiding) {
    // ヘリの姿勢
    let currentRot = $.getRotation();
    // カメラの姿勢
    let cameraRot = $.state.cameraRotation ?? currentRot;
    
    let currentForce = $.state.force ?? Vector3Zero;

    // 目標とする上昇する力を計算する
    let targetForce = Vector3Up.clone()
      // 入力がニュートラルのときにホバリングするように､重力を打ち消す力を加える
      .multiplyScalar(steerInput.y * power * mass - gravity * mass)
      .applyQuaternion(currentRot);

    // 現在の力から目標の力に向かって変化させる
    force = currentForce.clone().lerp(targetForce, deltaTime * powerFilterFactor);
    torque = calcTorque(currentRot, cameraRot).multiplyScalar(torquePower * mass);
  }

  // state に上昇・回転する力を格納する
  $.state.force = force;
  $.state.torque = torque;

  // ローター音の音量を設定する
  rotorSound.volume = steerInput.y * rotorSoundVolumeFactor + rotorSoundVolumeOffset;

  // ローターの回転速度を設定する
  let rotorSpeed = steerInput.y * rotorAnimationSpeedFactor + rotorAnimationSpeedOffset;
  for (let i = 0; i < rotorSubNodes.length; i++) {
    let rotor = rotorSubNodes[i];
    rotor.setRotation(rotor.getRotation().multiply(new Quaternion().setFromAxisAngle(Vector3Up, rotorSpeed * deltaTime)));
  }
});

$.onPhysicsUpdate(_ => {
  // state から上昇・回転する力を取り出す
  let force = $.state.force ?? Vector3Zero;
  let torque = $.state.torque ?? Vector3Zero;
  // 進行・回転方向
  let velocity = $.velocity;
  let angularVelocity = $.angularVelocity;
  
  // 抗力 (進行・回転方向の逆向きの力) を計算する
  let dragForce = velocity.clone().normalize().multiplyScalar(-velocity.lengthSq() * drag);
  let dragTorque = angularVelocity.clone().normalize().multiplyScalar(-angularVelocity.lengthSq() * angularDrag);

  // 上昇・回転する力に進行方向の逆向きの力を加えて､最終的な力を反映する
  $.addForce(force.add(dragForce));
  $.addTorque(torque.add(dragTorque));
});

$.onReceive((messageType, arg, sender) => {
  if ($.state.ridingPlayer == null || sender.id !== $.state.ridingPlayer.id) {
    return;
  }
  switch (messageType) {
    case "update_camera_rotation":
      $.state.cameraRotation = arg;
      break;
  }
}, { player: true });
