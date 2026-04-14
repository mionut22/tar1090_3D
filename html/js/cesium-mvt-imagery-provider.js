var q = Object.defineProperty;
var z = (t, e, i) => e in t ? q(t, e, { enumerable: !0, configurable: !0, writable: !0, value: i }) : t[e] = i;
var y = (t, e, i) => (z(t, typeof e != "symbol" ? e + "" : e, i), i);
import { WindingOrder as D, Event as K, WebMercatorTilingScheme as X, Credit as Y, Cartesian2 as g, Cartographic as Z, Resource as Q } from "cesium";
var T = V;
function V(t, e) {
  this.x = t, this.y = e;
}
V.prototype = {
  /**
   * Clone this point, returning a new point that can be modified
   * without affecting the old one.
   * @return {Point} the clone
   */
  clone: function () {
    return new V(this.x, this.y);
  },
  /**
   * Add this point's x & y coordinates to another point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  add: function (t) {
    return this.clone()._add(t);
  },
  /**
   * Subtract this point's x & y coordinates to from point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  sub: function (t) {
    return this.clone()._sub(t);
  },
  /**
   * Multiply this point's x & y coordinates by point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  multByPoint: function (t) {
    return this.clone()._multByPoint(t);
  },
  /**
   * Divide this point's x & y coordinates by point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  divByPoint: function (t) {
    return this.clone()._divByPoint(t);
  },
  /**
   * Multiply this point's x & y coordinates by a factor,
   * yielding a new point.
   * @param {Point} k factor
   * @return {Point} output point
   */
  mult: function (t) {
    return this.clone()._mult(t);
  },
  /**
   * Divide this point's x & y coordinates by a factor,
   * yielding a new point.
   * @param {Point} k factor
   * @return {Point} output point
   */
  div: function (t) {
    return this.clone()._div(t);
  },
  /**
   * Rotate this point around the 0, 0 origin by an angle a,
   * given in radians
   * @param {Number} a angle to rotate around, in radians
   * @return {Point} output point
   */
  rotate: function (t) {
    return this.clone()._rotate(t);
  },
  /**
   * Rotate this point around p point by an angle a,
   * given in radians
   * @param {Number} a angle to rotate around, in radians
   * @param {Point} p Point to rotate around
   * @return {Point} output point
   */
  rotateAround: function (t, e) {
    return this.clone()._rotateAround(t, e);
  },
  /**
   * Multiply this point by a 4x1 transformation matrix
   * @param {Array<Number>} m transformation matrix
   * @return {Point} output point
   */
  matMult: function (t) {
    return this.clone()._matMult(t);
  },
  /**
   * Calculate this point but as a unit vector from 0, 0, meaning
   * that the distance from the resulting point to the 0, 0
   * coordinate will be equal to 1 and the angle from the resulting
   * point to the 0, 0 coordinate will be the same as before.
   * @return {Point} unit vector point
   */
  unit: function () {
    return this.clone()._unit();
  },
  /**
   * Compute a perpendicular point, where the new y coordinate
   * is the old x coordinate and the new x coordinate is the old y
   * coordinate multiplied by -1
   * @return {Point} perpendicular point
   */
  perp: function () {
    return this.clone()._perp();
  },
  /**
   * Return a version of this point with the x & y coordinates
   * rounded to integers.
   * @return {Point} rounded point
   */
  round: function () {
    return this.clone()._round();
  },
  /**
   * Return the magitude of this point: this is the Euclidean
   * distance from the 0, 0 coordinate to this point's x and y
   * coordinates.
   * @return {Number} magnitude
   */
  mag: function () {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  },
  /**
   * Judge whether this point is equal to another point, returning
   * true or false.
   * @param {Point} other the other point
   * @return {boolean} whether the points are equal
   */
  equals: function (t) {
    return this.x === t.x && this.y === t.y;
  },
  /**
   * Calculate the distance from this point to another point
   * @param {Point} p the other point
   * @return {Number} distance
   */
  dist: function (t) {
    return Math.sqrt(this.distSqr(t));
  },
  /**
   * Calculate the distance from this point to another point,
   * without the square root step. Useful if you're comparing
   * relative distances.
   * @param {Point} p the other point
   * @return {Number} distance
   */
  distSqr: function (t) {
    var e = t.x - this.x, i = t.y - this.y;
    return e * e + i * i;
  },
  /**
   * Get the angle from the 0, 0 coordinate to this point, in radians
   * coordinates.
   * @return {Number} angle
   */
  angle: function () {
    return Math.atan2(this.y, this.x);
  },
  /**
   * Get the angle from this point to another point, in radians
   * @param {Point} b the other point
   * @return {Number} angle
   */
  angleTo: function (t) {
    return Math.atan2(this.y - t.y, this.x - t.x);
  },
  /**
   * Get the angle between this point and another point, in radians
   * @param {Point} b the other point
   * @return {Number} angle
   */
  angleWith: function (t) {
    return this.angleWithSep(t.x, t.y);
  },
  /*
   * Find the angle of the two vectors, solving the formula for
   * the cross product a x b = |a||b|sin(θ) for θ.
   * @param {Number} x the x-coordinate
   * @param {Number} y the y-coordinate
   * @return {Number} the angle in radians
   */
  angleWithSep: function (t, e) {
    return Math.atan2(
      this.x * e - this.y * t,
      this.x * t + this.y * e
    );
  },
  _matMult: function (t) {
    var e = t[0] * this.x + t[1] * this.y, i = t[2] * this.x + t[3] * this.y;
    return this.x = e, this.y = i, this;
  },
  _add: function (t) {
    return this.x += t.x, this.y += t.y, this;
  },
  _sub: function (t) {
    return this.x -= t.x, this.y -= t.y, this;
  },
  _mult: function (t) {
    return this.x *= t, this.y *= t, this;
  },
  _div: function (t) {
    return this.x /= t, this.y /= t, this;
  },
  _multByPoint: function (t) {
    return this.x *= t.x, this.y *= t.y, this;
  },
  _divByPoint: function (t) {
    return this.x /= t.x, this.y /= t.y, this;
  },
  _unit: function () {
    return this._div(this.mag()), this;
  },
  _perp: function () {
    var t = this.y;
    return this.y = this.x, this.x = -t, this;
  },
  _rotate: function (t) {
    var e = Math.cos(t), i = Math.sin(t), r = e * this.x - i * this.y, s = i * this.x + e * this.y;
    return this.x = r, this.y = s, this;
  },
  _rotateAround: function (t, e) {
    var i = Math.cos(t), r = Math.sin(t), s = e.x + i * (this.x - e.x) - r * (this.y - e.y), n = e.y + r * (this.x - e.x) + i * (this.y - e.y);
    return this.x = s, this.y = n, this;
  },
  _round: function () {
    return this.x = Math.round(this.x), this.y = Math.round(this.y), this;
  }
};
V.convert = function (t) {
  return t instanceof V ? t : Array.isArray(t) ? new V(t[0], t[1]) : t;
};
var b = T, H = P;
function P(t, e, i, r, s) {
  this.properties = {}, this.extent = i, this.type = 0, this._pbf = t, this._geometry = -1, this._keys = r, this._values = s, t.readFields(tt, this, e);
}
function tt(t, e, i) {
  t == 1 ? e.id = i.readVarint() : t == 2 ? et(i, e) : t == 3 ? e.type = i.readVarint() : t == 4 && (e._geometry = i.pos);
}
function et(t, e) {
  for (var i = t.readVarint() + t.pos; t.pos < i;) {
    var r = e._keys[t.readVarint()], s = e._values[t.readVarint()];
    e.properties[r] = s;
  }
}
P.types = ["Unknown", "Point", "LineString", "Polygon"];
P.prototype.loadGeometry = function () {
  var t = this._pbf;
  t.pos = this._geometry;
  for (var e = t.readVarint() + t.pos, i = 1, r = 0, s = 0, n = 0, o = [], a; t.pos < e;) {
    if (r <= 0) {
      var h = t.readVarint();
      i = h & 7, r = h >> 3;
    }
    if (r--, i === 1 || i === 2)
      s += t.readSVarint(), n += t.readSVarint(), i === 1 && (a && o.push(a), a = []), a.push(new b(s, n));
    else if (i === 7)
      a && a.push(a[0].clone());
    else
      throw new Error("unknown command " + i);
  }
  return a && o.push(a), o;
};
P.prototype.bbox = function () {
  var t = this._pbf;
  t.pos = this._geometry;
  for (var e = t.readVarint() + t.pos, i = 1, r = 0, s = 0, n = 0, o = 1 / 0, a = -1 / 0, h = 1 / 0, f = -1 / 0; t.pos < e;) {
    if (r <= 0) {
      var u = t.readVarint();
      i = u & 7, r = u >> 3;
    }
    if (r--, i === 1 || i === 2)
      s += t.readSVarint(), n += t.readSVarint(), s < o && (o = s), s > a && (a = s), n < h && (h = n), n > f && (f = n);
    else if (i !== 7)
      throw new Error("unknown command " + i);
  }
  return [o, h, a, f];
};
P.prototype.toGeoJSON = function (t, e, i) {
  var r = this.extent * Math.pow(2, i), s = this.extent * t, n = this.extent * e, o = this.loadGeometry(), a = P.types[this.type], h, f;
  function u(p) {
    for (var x = 0; x < p.length; x++) {
      var c = p[x], F = 180 - (c.y + n) * 360 / r;
      p[x] = [
        (c.x + s) * 360 / r - 180,
        360 / Math.PI * Math.atan(Math.exp(F * Math.PI / 180)) - 90
      ];
    }
  }
  switch (this.type) {
    case 1:
      var d = [];
      for (h = 0; h < o.length; h++)
        d[h] = o[h][0];
      o = d, u(o);
      break;
    case 2:
      for (h = 0; h < o.length; h++)
        u(o[h]);
      break;
    case 3:
      for (o = it(o), h = 0; h < o.length; h++)
        for (f = 0; f < o[h].length; f++)
          u(o[h][f]);
      break;
  }
  o.length === 1 ? o = o[0] : a = "Multi" + a;
  var w = {
    type: "Feature",
    geometry: {
      type: a,
      coordinates: o
    },
    properties: this.properties
  };
  return "id" in this && (w.id = this.id), w;
};
function it(t) {
  var e = t.length;
  if (e <= 1)
    return [t];
  for (var i = [], r, s, n = 0; n < e; n++) {
    var o = rt(t[n]);
    o !== 0 && (s === void 0 && (s = o < 0), s === o < 0 ? (r && i.push(r), r = [t[n]]) : r.push(t[n]));
  }
  return r && i.push(r), i;
}
function rt(t) {
  for (var e = 0, i = 0, r = t.length, s = r - 1, n, o; i < r; s = i++)
    n = t[i], o = t[s], e += (o.x - n.x) * (n.y + o.y);
  return e;
}
var nt = H, st = $;
function $(t, e) {
  this.version = 1, this.name = null, this.extent = 4096, this.length = 0, this._pbf = t, this._keys = [], this._values = [], this._features = [], t.readFields(ot, this, e), this.length = this._features.length;
}
function ot(t, e, i) {
  t === 15 ? e.version = i.readVarint() : t === 1 ? e.name = i.readString() : t === 5 ? e.extent = i.readVarint() : t === 2 ? e._features.push(i.pos) : t === 3 ? e._keys.push(i.readString()) : t === 4 && e._values.push(ht(i));
}
function ht(t) {
  for (var e = null, i = t.readVarint() + t.pos; t.pos < i;) {
    var r = t.readVarint() >> 3;
    e = r === 1 ? t.readString() : r === 2 ? t.readFloat() : r === 3 ? t.readDouble() : r === 4 ? t.readVarint64() : r === 5 ? t.readVarint() : r === 6 ? t.readSVarint() : r === 7 ? t.readBoolean() : null;
  }
  return e;
}
$.prototype.feature = function (t) {
  if (t < 0 || t >= this._features.length)
    throw new Error("feature index out of bounds");
  this._pbf.pos = this._features[t];
  var e = this._pbf.readVarint() + this._pbf.pos;
  return new nt(this._pbf, e, this.extent, this._keys, this._values);
};
var at = st, ut = ft;
function ft(t, e) {
  this.layers = t.readFields(lt, {}, e);
}
function lt(t, e, i) {
  if (t === 3) {
    var r = new at(i, i.readVarint() + i.pos);
    r.length && (e[r.name] = r);
  }
}
var dt = ut, v = H, N = {};
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
N.read = function (t, e, i, r, s) {
  var n, o, a = s * 8 - r - 1, h = (1 << a) - 1, f = h >> 1, u = -7, d = i ? s - 1 : 0, w = i ? -1 : 1, p = t[e + d];
  for (d += w, n = p & (1 << -u) - 1, p >>= -u, u += a; u > 0; n = n * 256 + t[e + d], d += w, u -= 8)
    ;
  for (o = n & (1 << -u) - 1, n >>= -u, u += r; u > 0; o = o * 256 + t[e + d], d += w, u -= 8)
    ;
  if (n === 0)
    n = 1 - f;
  else {
    if (n === h)
      return o ? NaN : (p ? -1 : 1) * (1 / 0);
    o = o + Math.pow(2, r), n = n - f;
  }
  return (p ? -1 : 1) * o * Math.pow(2, n - r);
};
N.write = function (t, e, i, r, s, n) {
  var o, a, h, f = n * 8 - s - 1, u = (1 << f) - 1, d = u >> 1, w = s === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0, p = r ? 0 : n - 1, x = r ? 1 : -1, c = e < 0 || e === 0 && 1 / e < 0 ? 1 : 0;
  for (e = Math.abs(e), isNaN(e) || e === 1 / 0 ? (a = isNaN(e) ? 1 : 0, o = u) : (o = Math.floor(Math.log(e) / Math.LN2), e * (h = Math.pow(2, -o)) < 1 && (o--, h *= 2), o + d >= 1 ? e += w / h : e += w * Math.pow(2, 1 - d), e * h >= 2 && (o++, h /= 2), o + d >= u ? (a = 0, o = u) : o + d >= 1 ? (a = (e * h - 1) * Math.pow(2, s), o = o + d) : (a = e * Math.pow(2, d - 1) * Math.pow(2, s), o = 0)); s >= 8; t[i + p] = a & 255, p += x, a /= 256, s -= 8)
    ;
  for (o = o << s | a, f += s; f > 0; t[i + p] = o & 255, p += x, o /= 256, f -= 8)
    ;
  t[i + p - x] |= c * 128;
};
var ct = l, M = N;
function l(t) {
  this.buf = ArrayBuffer.isView && ArrayBuffer.isView(t) ? t : new Uint8Array(t || 0), this.pos = 0, this.type = 0, this.length = this.buf.length;
}
l.Varint = 0;
l.Fixed64 = 1;
l.Bytes = 2;
l.Fixed32 = 5;
var R = (1 << 16) * (1 << 16), L = 1 / R, xt = 12, j = typeof TextDecoder > "u" ? null : new TextDecoder("utf8");
l.prototype = {
  destroy: function () {
    this.buf = null;
  },
  // === READING =================================================================
  readFields: function (t, e, i) {
    for (i = i || this.length; this.pos < i;) {
      var r = this.readVarint(), s = r >> 3, n = this.pos;
      this.type = r & 7, t(s, e, this), this.pos === n && this.skip(r);
    }
    return e;
  },
  readMessage: function (t, e) {
    return this.readFields(t, e, this.readVarint() + this.pos);
  },
  readFixed32: function () {
    var t = B(this.buf, this.pos);
    return this.pos += 4, t;
  },
  readSFixed32: function () {
    var t = A(this.buf, this.pos);
    return this.pos += 4, t;
  },
  // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)
  readFixed64: function () {
    var t = B(this.buf, this.pos) + B(this.buf, this.pos + 4) * R;
    return this.pos += 8, t;
  },
  readSFixed64: function () {
    var t = B(this.buf, this.pos) + A(this.buf, this.pos + 4) * R;
    return this.pos += 8, t;
  },
  readFloat: function () {
    var t = M.read(this.buf, this.pos, !0, 23, 4);
    return this.pos += 4, t;
  },
  readDouble: function () {
    var t = M.read(this.buf, this.pos, !0, 52, 8);
    return this.pos += 8, t;
  },
  readVarint: function (t) {
    var e = this.buf, i, r;
    return r = e[this.pos++], i = r & 127, r < 128 || (r = e[this.pos++], i |= (r & 127) << 7, r < 128) || (r = e[this.pos++], i |= (r & 127) << 14, r < 128) || (r = e[this.pos++], i |= (r & 127) << 21, r < 128) ? i : (r = e[this.pos], i |= (r & 15) << 28, yt(i, t, this));
  },
  readVarint64: function () {
    return this.readVarint(!0);
  },
  readSVarint: function () {
    var t = this.readVarint();
    return t % 2 === 1 ? (t + 1) / -2 : t / 2;
  },
  readBoolean: function () {
    return Boolean(this.readVarint());
  },
  readString: function () {
    var t = this.readVarint() + this.pos, e = this.pos;
    return this.pos = t, t - e >= xt && j ? Tt(this.buf, e, t) : Bt(this.buf, e, t);
  },
  readBytes: function () {
    var t = this.readVarint() + this.pos, e = this.buf.subarray(this.pos, t);
    return this.pos = t, e;
  },
  // verbose for performance reasons; doesn't affect gzipped size
  readPackedVarint: function (t, e) {
    if (this.type !== l.Bytes)
      return t.push(this.readVarint(e));
    var i = _(this);
    for (t = t || []; this.pos < i;)
      t.push(this.readVarint(e));
    return t;
  },
  readPackedSVarint: function (t) {
    if (this.type !== l.Bytes)
      return t.push(this.readSVarint());
    var e = _(this);
    for (t = t || []; this.pos < e;)
      t.push(this.readSVarint());
    return t;
  },
  readPackedBoolean: function (t) {
    if (this.type !== l.Bytes)
      return t.push(this.readBoolean());
    var e = _(this);
    for (t = t || []; this.pos < e;)
      t.push(this.readBoolean());
    return t;
  },
  readPackedFloat: function (t) {
    if (this.type !== l.Bytes)
      return t.push(this.readFloat());
    var e = _(this);
    for (t = t || []; this.pos < e;)
      t.push(this.readFloat());
    return t;
  },
  readPackedDouble: function (t) {
    if (this.type !== l.Bytes)
      return t.push(this.readDouble());
    var e = _(this);
    for (t = t || []; this.pos < e;)
      t.push(this.readDouble());
    return t;
  },
  readPackedFixed32: function (t) {
    if (this.type !== l.Bytes)
      return t.push(this.readFixed32());
    var e = _(this);
    for (t = t || []; this.pos < e;)
      t.push(this.readFixed32());
    return t;
  },
  readPackedSFixed32: function (t) {
    if (this.type !== l.Bytes)
      return t.push(this.readSFixed32());
    var e = _(this);
    for (t = t || []; this.pos < e;)
      t.push(this.readSFixed32());
    return t;
  },
  readPackedFixed64: function (t) {
    if (this.type !== l.Bytes)
      return t.push(this.readFixed64());
    var e = _(this);
    for (t = t || []; this.pos < e;)
      t.push(this.readFixed64());
    return t;
  },
  readPackedSFixed64: function (t) {
    if (this.type !== l.Bytes)
      return t.push(this.readSFixed64());
    var e = _(this);
    for (t = t || []; this.pos < e;)
      t.push(this.readSFixed64());
    return t;
  },
  skip: function (t) {
    var e = t & 7;
    if (e === l.Varint)
      for (; this.buf[this.pos++] > 127;)
        ;
    else if (e === l.Bytes)
      this.pos = this.readVarint() + this.pos;
    else if (e === l.Fixed32)
      this.pos += 4;
    else if (e === l.Fixed64)
      this.pos += 8;
    else
      throw new Error("Unimplemented type: " + e);
  },
  // === WRITING =================================================================
  writeTag: function (t, e) {
    this.writeVarint(t << 3 | e);
  },
  realloc: function (t) {
    for (var e = this.length || 16; e < this.pos + t;)
      e *= 2;
    if (e !== this.length) {
      var i = new Uint8Array(e);
      i.set(this.buf), this.buf = i, this.length = e;
    }
  },
  finish: function () {
    return this.length = this.pos, this.pos = 0, this.buf.subarray(0, this.length);
  },
  writeFixed32: function (t) {
    this.realloc(4), S(this.buf, t, this.pos), this.pos += 4;
  },
  writeSFixed32: function (t) {
    this.realloc(4), S(this.buf, t, this.pos), this.pos += 4;
  },
  writeFixed64: function (t) {
    this.realloc(8), S(this.buf, t & -1, this.pos), S(this.buf, Math.floor(t * L), this.pos + 4), this.pos += 8;
  },
  writeSFixed64: function (t) {
    this.realloc(8), S(this.buf, t & -1, this.pos), S(this.buf, Math.floor(t * L), this.pos + 4), this.pos += 8;
  },
  writeVarint: function (t) {
    if (t = +t || 0, t > 268435455 || t < 0) {
      pt(t, this);
      return;
    }
    this.realloc(4), this.buf[this.pos++] = t & 127 | (t > 127 ? 128 : 0), !(t <= 127) && (this.buf[this.pos++] = (t >>>= 7) & 127 | (t > 127 ? 128 : 0), !(t <= 127) && (this.buf[this.pos++] = (t >>>= 7) & 127 | (t > 127 ? 128 : 0), !(t <= 127) && (this.buf[this.pos++] = t >>> 7 & 127)));
  },
  writeSVarint: function (t) {
    this.writeVarint(t < 0 ? -t * 2 - 1 : t * 2);
  },
  writeBoolean: function (t) {
    this.writeVarint(Boolean(t));
  },
  writeString: function (t) {
    t = String(t), this.realloc(t.length * 4), this.pos++;
    var e = this.pos;
    this.pos = Ct(this.buf, t, this.pos);
    var i = this.pos - e;
    i >= 128 && I(e, i, this), this.pos = e - 1, this.writeVarint(i), this.pos += i;
  },
  writeFloat: function (t) {
    this.realloc(4), M.write(this.buf, t, this.pos, !0, 23, 4), this.pos += 4;
  },
  writeDouble: function (t) {
    this.realloc(8), M.write(this.buf, t, this.pos, !0, 52, 8), this.pos += 8;
  },
  writeBytes: function (t) {
    var e = t.length;
    this.writeVarint(e), this.realloc(e);
    for (var i = 0; i < e; i++)
      this.buf[this.pos++] = t[i];
  },
  writeRawMessage: function (t, e) {
    this.pos++;
    var i = this.pos;
    t(e, this);
    var r = this.pos - i;
    r >= 128 && I(i, r, this), this.pos = i - 1, this.writeVarint(r), this.pos += r;
  },
  writeMessage: function (t, e, i) {
    this.writeTag(t, l.Bytes), this.writeRawMessage(e, i);
  },
  writePackedVarint: function (t, e) {
    e.length && this.writeMessage(t, _t, e);
  },
  writePackedSVarint: function (t, e) {
    e.length && this.writeMessage(t, Ft, e);
  },
  writePackedBoolean: function (t, e) {
    e.length && this.writeMessage(t, St, e);
  },
  writePackedFloat: function (t, e) {
    e.length && this.writeMessage(t, vt, e);
  },
  writePackedDouble: function (t, e) {
    e.length && this.writeMessage(t, mt, e);
  },
  writePackedFixed32: function (t, e) {
    e.length && this.writeMessage(t, Vt, e);
  },
  writePackedSFixed32: function (t, e) {
    e.length && this.writeMessage(t, Pt, e);
  },
  writePackedFixed64: function (t, e) {
    e.length && this.writeMessage(t, kt, e);
  },
  writePackedSFixed64: function (t, e) {
    e.length && this.writeMessage(t, Mt, e);
  },
  writeBytesField: function (t, e) {
    this.writeTag(t, l.Bytes), this.writeBytes(e);
  },
  writeFixed32Field: function (t, e) {
    this.writeTag(t, l.Fixed32), this.writeFixed32(e);
  },
  writeSFixed32Field: function (t, e) {
    this.writeTag(t, l.Fixed32), this.writeSFixed32(e);
  },
  writeFixed64Field: function (t, e) {
    this.writeTag(t, l.Fixed64), this.writeFixed64(e);
  },
  writeSFixed64Field: function (t, e) {
    this.writeTag(t, l.Fixed64), this.writeSFixed64(e);
  },
  writeVarintField: function (t, e) {
    this.writeTag(t, l.Varint), this.writeVarint(e);
  },
  writeSVarintField: function (t, e) {
    this.writeTag(t, l.Varint), this.writeSVarint(e);
  },
  writeStringField: function (t, e) {
    this.writeTag(t, l.Bytes), this.writeString(e);
  },
  writeFloatField: function (t, e) {
    this.writeTag(t, l.Fixed32), this.writeFloat(e);
  },
  writeDoubleField: function (t, e) {
    this.writeTag(t, l.Fixed64), this.writeDouble(e);
  },
  writeBooleanField: function (t, e) {
    this.writeVarintField(t, Boolean(e));
  }
};
function yt(t, e, i) {
  var r = i.buf, s, n;
  if (n = r[i.pos++], s = (n & 112) >> 4, n < 128 || (n = r[i.pos++], s |= (n & 127) << 3, n < 128) || (n = r[i.pos++], s |= (n & 127) << 10, n < 128) || (n = r[i.pos++], s |= (n & 127) << 17, n < 128) || (n = r[i.pos++], s |= (n & 127) << 24, n < 128) || (n = r[i.pos++], s |= (n & 1) << 31, n < 128))
    return m(t, s, e);
  throw new Error("Expected varint not more than 10 bytes");
}
function _(t) {
  return t.type === l.Bytes ? t.readVarint() + t.pos : t.pos + 1;
}
function m(t, e, i) {
  return i ? e * 4294967296 + (t >>> 0) : (e >>> 0) * 4294967296 + (t >>> 0);
}
function pt(t, e) {
  var i, r;
  if (t >= 0 ? (i = t % 4294967296 | 0, r = t / 4294967296 | 0) : (i = ~(-t % 4294967296), r = ~(-t / 4294967296), i ^ 4294967295 ? i = i + 1 | 0 : (i = 0, r = r + 1 | 0)), t >= 18446744073709552e3 || t < -18446744073709552e3)
    throw new Error("Given varint doesn't fit into 10 bytes");
  e.realloc(10), wt(i, r, e), gt(r, e);
}
function wt(t, e, i) {
  i.buf[i.pos++] = t & 127 | 128, t >>>= 7, i.buf[i.pos++] = t & 127 | 128, t >>>= 7, i.buf[i.pos++] = t & 127 | 128, t >>>= 7, i.buf[i.pos++] = t & 127 | 128, t >>>= 7, i.buf[i.pos] = t & 127;
}
function gt(t, e) {
  var i = (t & 7) << 4;
  e.buf[e.pos++] |= i | ((t >>>= 3) ? 128 : 0), t && (e.buf[e.pos++] = t & 127 | ((t >>>= 7) ? 128 : 0), t && (e.buf[e.pos++] = t & 127 | ((t >>>= 7) ? 128 : 0), t && (e.buf[e.pos++] = t & 127 | ((t >>>= 7) ? 128 : 0), t && (e.buf[e.pos++] = t & 127 | ((t >>>= 7) ? 128 : 0), t && (e.buf[e.pos++] = t & 127)))));
}
function I(t, e, i) {
  var r = e <= 16383 ? 1 : e <= 2097151 ? 2 : e <= 268435455 ? 3 : Math.floor(Math.log(e) / (Math.LN2 * 7));
  i.realloc(r);
  for (var s = i.pos - 1; s >= t; s--)
    i.buf[s + r] = i.buf[s];
}
function _t(t, e) {
  for (var i = 0; i < t.length; i++)
    e.writeVarint(t[i]);
}
function Ft(t, e) {
  for (var i = 0; i < t.length; i++)
    e.writeSVarint(t[i]);
}
function vt(t, e) {
  for (var i = 0; i < t.length; i++)
    e.writeFloat(t[i]);
}
function mt(t, e) {
  for (var i = 0; i < t.length; i++)
    e.writeDouble(t[i]);
}
function St(t, e) {
  for (var i = 0; i < t.length; i++)
    e.writeBoolean(t[i]);
}
function Vt(t, e) {
  for (var i = 0; i < t.length; i++)
    e.writeFixed32(t[i]);
}
function Pt(t, e) {
  for (var i = 0; i < t.length; i++)
    e.writeSFixed32(t[i]);
}
function kt(t, e) {
  for (var i = 0; i < t.length; i++)
    e.writeFixed64(t[i]);
}
function Mt(t, e) {
  for (var i = 0; i < t.length; i++)
    e.writeSFixed64(t[i]);
}
function B(t, e) {
  return (t[e] | t[e + 1] << 8 | t[e + 2] << 16) + t[e + 3] * 16777216;
}
function S(t, e, i) {
  t[i] = e, t[i + 1] = e >>> 8, t[i + 2] = e >>> 16, t[i + 3] = e >>> 24;
}
function A(t, e) {
  return (t[e] | t[e + 1] << 8 | t[e + 2] << 16) + (t[e + 3] << 24);
}
function Bt(t, e, i) {
  for (var r = "", s = e; s < i;) {
    var n = t[s], o = null, a = n > 239 ? 4 : n > 223 ? 3 : n > 191 ? 2 : 1;
    if (s + a > i)
      break;
    var h, f, u;
    a === 1 ? n < 128 && (o = n) : a === 2 ? (h = t[s + 1], (h & 192) === 128 && (o = (n & 31) << 6 | h & 63, o <= 127 && (o = null))) : a === 3 ? (h = t[s + 1], f = t[s + 2], (h & 192) === 128 && (f & 192) === 128 && (o = (n & 15) << 12 | (h & 63) << 6 | f & 63, (o <= 2047 || o >= 55296 && o <= 57343) && (o = null))) : a === 4 && (h = t[s + 1], f = t[s + 2], u = t[s + 3], (h & 192) === 128 && (f & 192) === 128 && (u & 192) === 128 && (o = (n & 15) << 18 | (h & 63) << 12 | (f & 63) << 6 | u & 63, (o <= 65535 || o >= 1114112) && (o = null))), o === null ? (o = 65533, a = 1) : o > 65535 && (o -= 65536, r += String.fromCharCode(o >>> 10 & 1023 | 55296), o = 56320 | o & 1023), r += String.fromCharCode(o), s += a;
  }
  return r;
}
function Tt(t, e, i) {
  return j.decode(t.subarray(e, i));
}
function Ct(t, e, i) {
  for (var r = 0, s, n; r < e.length; r++) {
    if (s = e.charCodeAt(r), s > 55295 && s < 57344)
      if (n)
        if (s < 56320) {
          t[i++] = 239, t[i++] = 191, t[i++] = 189, n = s;
          continue;
        } else
          s = n - 55296 << 10 | s - 56320 | 65536, n = null;
      else {
        s > 56319 || r + 1 === e.length ? (t[i++] = 239, t[i++] = 191, t[i++] = 189) : n = s;
        continue;
      }
    else
      n && (t[i++] = 239, t[i++] = 191, t[i++] = 189, n = null);
    s < 128 ? t[i++] = s : (s < 2048 ? t[i++] = s >> 6 | 192 : (s < 65536 ? t[i++] = s >> 12 | 224 : (t[i++] = s >> 18 | 240, t[i++] = s >> 12 & 63 | 128), t[i++] = s >> 6 & 63 | 128), t[i++] = s & 63 | 128);
  }
  return i;
}
function Et(t) {
  return Rt(t) === D.COUNTER_CLOCKWISE;
}
function G(t, e) {
  const i = t.x, r = t.y;
  let s = !1;
  for (let n = 0, o = e.length - 1; n < e.length; o = n++) {
    const a = e[n].x, h = e[n].y, f = e[o].x, u = e[o].y;
    h > r != u > r && i < (f - a) * (r - h) / (u - h) + a && (s = !s);
  }
  return s;
}
function Dt(t, e) {
  for (let i = 0; i < t.length; i++)
    if (G(e, t[i])) {
      let r = !1;
      for (; i + 1 < t.length && !Et(t[i + 1]);)
        i++, !r && G(e, t[i]) && (r = !0);
      if (!r)
        return !0;
    }
  return !1;
}
function Rt(t) {
  const e = t.length;
  let i = t[e - 1].x * (t[0].y - t[e - 2].y) + t[0].x * (t[1].y - t[e - 1].y);
  for (let r = 1; r <= e - 2; r++)
    i += t[r].x * (t[r + 1].y - t[r - 1].y);
  if (isNaN(i))
    throw new Error();
  return i > 0 ? D.COUNTER_CLOCKWISE : D.CLOCKWISE;
}
const Nt = new T(0, 0);
function Wt(t, e, i) {
  return t.length === 0 || t[0].length === 0 ? !1 : t[0][0].distSqr(e) <= i ** 2;
}
function Lt(t, e, i) {
  if (t.length === 0)
    return !1;
  const r = t[0], s = i / 2;
  for (let n = 0; n < r.length - 1; n++) {
    const o = r[n], a = r[n + 1];
    if (It(o, a, e, s, Nt))
      return !0;
  }
  return !1;
}
function It(t, e, i, r, s = new T(0, 0)) {
  const n = t.distSqr(e);
  if (n === 0)
    return !1;
  const o = ((i.x - t.x) * (e.x - t.x) + (i.y - t.y) * (e.y - t.y)) / n, a = Math.max(0, Math.min(1, o)), h = s;
  return h.x = t.x + a * (e.x - t.x), h.y = t.y + a * (e.y - t.y), i.distSqr(h) <= r ** 2;
}
const At = async (t, e) => {
  const i = await $t(t, e);
  return i ? Ot(i) : void 0;
}, Gt = 5, Ut = 5, k = 256;
class qt {
  constructor(e) {
    // Options
    y(this, "_minimumLevel");
    y(this, "_maximumLevel");
    y(this, "_urlTemplate");
    y(this, "_layerNames");
    y(this, "_credit");
    y(this, "_resolution");
    y(this, "_headers");
    y(this, "_currentUrl");
    y(this, "_onRenderFeature");
    y(this, "_onFeaturesRendered");
    y(this, "_style");
    y(this, "_onSelectFeature");
    y(this, "_parseTile");
    y(this, "_pickPointRadius");
    y(this, "_pickLineWidth");
    // Internal variables
    y(this, "_tilingScheme");
    y(this, "_tileWidth");
    y(this, "_tileHeight");
    y(this, "_rectangle");
    y(this, "_ready");
    y(this, "_readyPromise");
    y(this, "_errorEvent", new K());
    y(this, "_tileCaches", /* @__PURE__ */ new Map());
    this._minimumLevel = e.minimumLevel ?? 0, this._maximumLevel = e.maximumLevel ?? 1 / 0, this._urlTemplate = e.urlTemplate, this._layerNames = e.layerName.split(/, */).filter(Boolean), this._credit = e.credit, this._resolution = e.resolution ?? 5, this._headers = e.headers, this._onFeaturesRendered = e.onFeaturesRendered, this._onRenderFeature = e.onRenderFeature, this._style = e.style, this._onSelectFeature = e.onSelectFeature, this._parseTile = e.parseTile ?? At, this._pickPointRadius = e.pickPointRadius ?? Gt, this._pickLineWidth = e.pickLineWidth ?? Ut, this._tilingScheme = new X(), this._tileWidth = k, this._tileHeight = k, this._rectangle = this._tilingScheme.rectangle, this._ready = !0, this._readyPromise = Promise.resolve(!0);
  }
  get url() {
    return this._currentUrl;
  }
  get tileWidth() {
    return this._tileWidth;
  }
  get tileHeight() {
    return this._tileHeight;
  }
  // The `requestImage` is called when user zoom the globe.
  // But this invocation is restricted depends on `maximumLevel` or `minimumLevel`.
  get maximumLevel() {
    return this._maximumLevel;
  }
  get minimumLevel() {
    return this._minimumLevel;
  }
  get tilingScheme() {
    return this._tilingScheme;
  }
  get rectangle() {
    return this._rectangle;
  }
  get errorEvent() {
    return this._errorEvent;
  }
  get ready() {
    return this._ready;
  }
  get hasAlphaChannel() {
    return !0;
  }
  get credit() {
    return this._credit ? new Y(this._credit) : void 0;
  }
  // Unused values
  get defaultNightAlpha() {
  }
  get defaultDayAlpha() {
  }
  get defaultAlpha() {
  }
  get defaultBrightness() {
  }
  get defaultContrast() {
  }
  get defaultHue() {
  }
  get defaultSaturation() {
  }
  get defaultGamma() {
  }
  get defaultMinificationFilter() {
  }
  get defaultMagnificationFilter() {
  }
  get readyPromise() {
    return this._readyPromise;
  }
  get tileDiscardPolicy() {
  }
  get proxy() {
  }
  getTileCredits(e, i, r) {
    return [];
  }
  requestImage(e, i, r, s) {
    const n = document.createElement("canvas"), o = {
      x: e,
      y: i,
      level: r
    }, a = (r >= this.maximumLevel ? this._resolution : void 0) ?? 1;
    return n.width = this._tileWidth * a, n.height = this._tileHeight * a, this._currentUrl = U(this._urlTemplate, o), Promise.all(
      this._layerNames.map((h) => this._renderCanvas(n, o, h, a))
    ).then(() => n);
  }
  async _renderCanvas(e, i, r, s) {
    var f;
    if (!this._currentUrl)
      return e;
    const n = await this._cachedTile(this._currentUrl), a = r.split(/, */).filter(Boolean).map((u) => n == null ? void 0 : n.layers[u]);
    if (!a)
      return e;
    const h = e.getContext("2d");
    return h && (h.strokeStyle = "black", h.lineWidth = 1, h.miterLimit = 2, h.setTransform(
      this._tileWidth * s / k,
      0,
      0,
      this._tileHeight * s / k,
      0,
      0
    ), a.forEach((u) => {
      var w;
      if (!u)
        return;
      const d = k / u.extent;
      for (let p = 0; p < u.length; p++) {
        const x = u.feature(p);
        if (this._onRenderFeature && !this._onRenderFeature(x, i))
          continue;
        const c = (w = this._style) == null ? void 0 : w.call(this, x, i);
        c && (h.fillStyle = c.fillStyle ?? h.fillStyle, h.strokeStyle = c.strokeStyle ?? h.strokeStyle, h.lineWidth = c.lineWidth ?? h.lineWidth, h.lineJoin = c.lineJoin ?? h.lineJoin, v.types[x.type] === "Polygon" ? this._renderPolygon(h, x, d, (c.lineWidth ?? 1) > 0) : v.types[x.type] === "Point" ? this._renderPoint(h, x, d) : v.types[x.type] === "LineString" ? this._renderLineString(h, x, d) : console.error(
          `Unexpected geometry type: ${x.type} in region map on tile ${[
            i.level,
            i.x,
            i.y
          ].join("/")}`
        ));
      }
    }), (f = this._onFeaturesRendered) == null || f.call(this)), e;
  }
  _renderPolygon(e, i, r, s) {
    e.beginPath();
    const n = i.loadGeometry();
    for (let o = 0; o < n.length; o++) {
      let a = n[o][0];
      e.moveTo(a.x * r, a.y * r);
      for (let h = 1; h < n[o].length; h++)
        a = n[o][h], e.lineTo(a.x * r, a.y * r);
    }
    s && e.stroke(), e.fill();
  }
  _renderPoint(e, i, r) {
    e.beginPath();
    const s = i.loadGeometry();
    for (let n = 0; n < s.length; n++) {
      const o = s[n][0], [a, h] = [o.x * r, o.y * r], f = e.lineWidth;
      e.beginPath(), e.arc(a, h, f, 0, 2 * Math.PI), e.fill();
    }
  }
  _renderLineString(e, i, r) {
    e.beginPath();
    const s = i.loadGeometry();
    for (let n = 0; n < s.length; n++) {
      let o = s[n][0];
      e.moveTo(o.x * r, o.y * r);
      for (let a = 1; a < s[n].length; a++)
        o = s[n][a], e.lineTo(o.x * r, o.y * r);
    }
    e.stroke();
  }
  async pickFeatures(e, i, r, s, n) {
    const o = {
      x: e,
      y: i,
      level: r
    }, a = U(this._urlTemplate, o), h = await this._cachedTile(a);
    return (await Promise.all(
      this._layerNames.map(async (u) => {
        const d = h == null ? void 0 : h.layers[u];
        if (!d)
          return [];
        const w = await this._pickFeatures(o, s, n, d);
        return w || [];
      })
    )).flat();
  }
  async _pickFeatures(e, i, r, s) {
    const n = this._tilingScheme.tileXYToNativeRectangle(
      e.x,
      e.y,
      e.level
    ), o = [n.west, n.east], a = [n.north, n.south], h = function (x, c, F, C, E) {
      const W = new g();
      g.subtract(x, new g(c[0], F[0]), W);
      const J = new g(
        (C[1] - C[0]) / (c[1] - c[0]),
        (E[1] - E[0]) / (F[1] - F[0])
      );
      return g.add(
        g.multiplyComponents(W, J, new g()),
        new g(C[0], E[0]),
        new g()
      );
    }, f = [0, s.extent - 1], u = (f[1] - f[0]) / this._tileWidth, d = h(
      g.fromCartesian3(
        this._tilingScheme.projection.project(new Z(i, r))
      ),
      o,
      a,
      f,
      f
    ), w = new T(d.x, d.y), p = [];
    for (let x = 0; x < s.length; x++) {
      const c = s.feature(x);
      if ((v.types[c.type] === "Polygon" && Dt(c.loadGeometry(), w) || v.types[c.type] === "LineString" && Lt(
        c.loadGeometry(),
        w,
        O(this._pickLineWidth, c, e) * u
      ) || v.types[c.type] === "Point" && Wt(
        c.loadGeometry(),
        w,
        O(this._pickPointRadius, c, e) * u
      )) && this._onSelectFeature) {
        const F = this._onSelectFeature(c, e);
        F && p.push(F);
      }
    }
    return p;
  }
  async _cachedTile(e) {
    if (!e)
      return;
    const i = this._tileCaches.get(e);
    if (i)
      return i;
    const r = Ht(await this._parseTile(e, this._headers));
    return r && this._tileCaches.set(e, r), r;
  }
}
const U = (t, e) => decodeURIComponent(t).replace("{z}", String(e.level)).replace("{x}", String(e.x)).replace("{y}", String(e.y)), Ot = (t) => new dt(new ct(t)), Ht = (t) => {
  var i;
  if (!t)
    return;
  const e = {};
  for (const [r, s] of Object.entries(t.layers)) {
    const n = [], o = s;
    for (let a = 0; a < o.length; a++) {
      const h = o.feature(a), f = h.loadGeometry(), u = (i = h.bbox) == null ? void 0 : i.call(h), d = {
        ...h,
        id: h.id,
        loadGeometry: () => f,
        bbox: u ? () => u : void 0,
        toGeoJSON: h.toGeoJSON
      };
      n.push(d);
    }
    e[r] = {
      ...o,
      feature: (a) => n[a]
    };
  }
  return { layers: e };
}, $t = (t, e) => {
  var i;
  if (!t)
    throw new Error("fetch request is failed because request url is undefined");
  return (i = Q.fetchArrayBuffer({ url: t, headers: e })) == null ? void 0 : i.catch(() => {
  });
};
function O(t, e, i) {
  return typeof t == "number" ? t : t(e, i);
}
export {
  qt as CesiumMVTImageryProvider,
  qt as default
};
