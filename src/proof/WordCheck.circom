pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

template AssertZero() {
    signal input x;
    x <== 0;
}

template IsEq() {
    signal input a;
    signal input b;
    signal output out;

    signal diff <== a - b;

    signal inv;
    inv <-- diff == 0 ? 1 : 0;

    inv * (1 - inv) === 0;
    diff * inv === 0;

    out <== inv;
}

template WordToInt3() {
    signal input ascii[20];
    signal output wordInt;

    signal accum[21];
    accum[0] <== 0;

    for (var i = 0; i < 20; i++) {
        accum[i+1] <== accum[i]*1000+ascii[i];
    }
    
    wordInt <== accum[20];
}

template WordCheck() {
    signal input word[20];
    signal input storedHash;
    signal output isMatch;

    component wti3 = WordToInt3();
    for (var i = 0; i < 20; i++) {
        wti3.ascii[i] <== word[i];
    }
    var wordAsInt = wti3.wordInt;

    component pose = Poseidon(2);
    pose.inputs[0] <== wordAsInt;
    pose.inputs[1] <== 0;
    var finalHash = pose.out;

    component eq = IsEq();
    eq.a <== finalHash;
    eq.b <== storedHash;
    isMatch <== eq.out;
}

component main {public[storedHash]} = WordCheck();