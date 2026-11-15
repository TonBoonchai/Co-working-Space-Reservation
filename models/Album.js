const sql = require("../config/pgdb");

const Album = function (album) {
  this.id = album.id;
  this.title = album.title;
  this.artist = album.artist;
  this.price = album.price;
};

Album.getAll = (result) => {
  sql.query("SELECT * FROM albums;", (err, res) => {
    if (err) {
      console.log("error: ", err);
      result(err, null);
      return;
    }
    console.log("All albums:");
    console.log(res.rows);
    result(null, res.rows);
  });
};

Album.findById = (id, result) => {
  sql.query("SELECT * FROM albums WHERE id = $1;", [id], (err, res) => {
    if (err) {
      console.log("error: ", err);
      result(err, null);
      return;
    }

    if (res.rows.length) {
      console.log("found album: ", res.rows[0]);
      result(null, res.rows[0]);
      return;
    }

    // not found album with the id
    result({ msg: "not_found" }, null);
  });
};

Album.create = (newAlbum, result) => {
  const { title, artist, price } = newAlbum;
  const query =
    "INSERT INTO albums (title, artist, price) VALUES ($1, $2, $3) RETURNING *;";

  sql.query(query, [title, artist, price], (err, res) => {
    if (err) {
      console.log("create error: ", err);
      result(err, null);
      return;
    }
    console.log("created album:");
    console.log(res.rows);
    result(null, res.rows);
  });
};

Album.updateById = (id, album, result) => {
  const query =
    "UPDATE albums SET title = $1, artist = $2, price = $3 WHERE id = $4 RETURNING *;";

  sql.query(
    query,
    [album.title, album.artist, album.price, id],
    (err, res) => {
      if (err) {
        console.log("error: ", err);
        result(err, null);
        return;
      }
      if (res.rowCount == 0) {
        // not found album with the id
        result({ msg: "not_found" }, null);
        return;
      }

      console.log("updated album: ", res.rows);
      result(null, res.rows);
    },
  );
};

Album.remove = (id, result) => {
  const query = "DELETE FROM albums WHERE id = $1 RETURNING *;";

  sql.query(query, [id], (err, res) => {
    if (err) {
      console.log("error: ", err);
      result(err, null);
      return;
    }
    if (res.rowCount == 0) {
      // not found album with the id
      result({ msg: "not_found" }, null);
      return;
    }

    console.log("deleted album with id: ", id);
    result(null, res.rows);
  });
};

module.exports = Album;
