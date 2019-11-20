package util

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"

	"golang.org/x/crypto/pbkdf2"
)

const clientNonceBytes = 16
const prefix = "n,,"

//AuthScram get Scram key
func AuthScram(url, username, password string) (string, error) {
	rstr := getLocalRand()
	auth := genFirstAuthMsg(username, rstr)
	firstMsg, err := dolongin(url, auth)
	lastMsg, err := dolongin(url, genFinalAuthMsg(firstMsg, username, password, rstr))
	return "bearer " + lastMsg, err
}
func main() {
	username := "su"
	password := "su"
	//Authorization: HELLO username=c3U
	url := "http://example.com/api/demo/about"
	msg, _ := AuthScram(url, username, password)
	println(msg)
	return
}
func dolongin(url, auth string) (string, error) {
	client := &http.Client{}
	req, err := http.NewRequest("GET", url, nil)
	req.Header.Add("Authorization", auth)
	req.Header.Add("User-Agent", "haystack-go")
	if err != nil {
		println(err)
	}
	resp, err := client.Do(req)
	body, _ := ioutil.ReadAll(resp.Body)
	defer resp.Body.Close()
	var authHeader []string
	if resp.StatusCode == 401 {
		authHeader = resp.Header["Www-Authenticate"]
	} else if resp.StatusCode == 200 {
		authHeader = resp.Header["Authentication-Info"]

		// println(resp.Header["Authentication-Info"][0])

	}
	println(resp.StatusCode)
	println(string(body))
	if nil != authHeader {
		return authHeader[0], err
	}
	return "", err
}
func getLocalRand() string {
	rnd := make([]byte, clientNonceBytes)
	if _, err := rand.Read(rnd); err != nil {
		println("failed to generate state string")
		return ""
	}
	return base64.RawStdEncoding.EncodeToString([]byte(rnd))
}
func genFirstAuthMsg(user, rstr string) string {

	msg := prefix + "n=" + user + ",r=" + rstr
	println(msg)
	msg = base64.RawStdEncoding.EncodeToString([]byte(msg))
	return addScramData(msg, user)
}
func addScramData(msg, user string) string {
	authHeader :=
		"scram data=" + msg + ", handshakeToken=" + base64.RawStdEncoding.EncodeToString([]byte(user))
	println(authHeader)
	return authHeader
}
func genFinalAuthMsg(header, user, password, rstr string) string {
	m := stringToMap(header[6 : len(header)-1])
	rawMsg, _ := base64.RawStdEncoding.DecodeString(m["data"])
	rstmap := stringToMap(string(rawMsg))
	st, _ := base64.RawStdEncoding.DecodeString(rstmap["s"])
	count, _ := strconv.Atoi(rstmap["i"])
	key, _ := EncryptBySalt(password, st, count, 256/8)

	/**
		String cbind_input     = gs2_header;
	    String channel_binding = Base64.URI.encodeUTF8(cbind_input);
	    String nonce           = (String)data.get("r");
	    String c2_no_proof     = "c=" + channel_binding + ",r=" + nonce;

	    // proof
	    String hash = msg.param("hash");
	    String salt = (String)data.get("s");
	    int iterations = Integer.parseInt((String)data.get("i"));
	    String c1_bare = (String)cx.stash.get("c1_bare");
		String authMsg = c1_bare + "," + s1_msg + "," + c2_no_proof;
		n=su,r=7MhQO2GfBhKB8iNJC-b2uA,r=7MhQO2GfBhKB8iNJC-b2uA4ec032d3ba2ca858dc081e11b7d77be6,s=rIIbS3Ej5Qmd1EuXRTfjP2ei4fzs2gdIUWKjUD+xF44=,i=10000,c=biws,r=7MhQO2GfBhKB8iNJC-b2uA4ec032d3ba2ca858dc081e11b7d77be6
									  r=/yrIYbcb0IlxE3wIynzClw9bc858c6bd3c2e77090074de444e5ec9,s=rIIbS3Ej5Qmd1EuXRTfjP2ei4fzs2gdIUWKjUD+xF44=,i=10000
		**/
	// 	//ciws=base64 "n,,"
	c2noproof := "c=biws,r=" + rstmap["r"]
	authMsg := "n=" + user + ",r=" + rstr + "," + string(rawMsg) + "," + c2noproof
	println(authMsg)
	//abit := []byte("n=su,r=7MhQO2GfBhKB8iNJC-b2uA,r=7MhQO2GfBhKB8iNJC-b2uA4ec032d3ba2ca858dc081e11b7d77be6,s=rIIbS3Ej5Qmd1EuXRTfjP2ei4fzs2gdIUWKjUD+xF44=,i=10000,c=biws,r=7MhQO2GfBhKB8iNJC-b2uA4ec032d3ba2ca858dc081e11b7d77be6")
	prov := string(clientProof(key, []byte(authMsg)))
	println(prov)
	finalMsg := c2noproof + ",p=" + prov
	//finalMsg := "c=biws,r=TlajafYGAJ69sv4EM_0_0A99626be6f2c012760baa485342a75408,p=Di0RX4Qqwq3CWFyO8ceNwG7deb83gVjb7dQdVfwQCoM="
	//msg := "c=biws,r=TlajafYGAJ69sv4EM_0_0A99626be6f2c012760baa485342a75408,p=Di0RX4Qqwq3CWFyO8ceNwG7deb83gVjb7dQdVfwQCoM="
	println(finalMsg)
	return addScramData(base64.RawStdEncoding.EncodeToString([]byte(finalMsg)), user)
}
func stringToMap(rawString string) map[string]string {
	ss := strings.Split(rawString, ",")
	m := make(map[string]string)
	for _, pair := range ss {
		z := strings.Split(pair, "=")
		m[z[0]] = z[1]
		println(pair)
	}
	return m
}
func sendClientMsg(s string) string {
	// A real implementation would send this to a server and read a reply.
	return ""
}
func clientProof(saltedPass, authMsg []byte) []byte {
	hash := sha256.New
	shahash := hash()
	mac := hmac.New(hash, saltedPass)
	mac.Write([]byte("Client Key"))
	clientKey := mac.Sum(nil)
	shahash.Write(clientKey)
	storedKey := shahash.Sum(nil)
	mac = hmac.New(hash, storedKey)
	mac.Write(authMsg)
	clientProof := mac.Sum(nil)
	for i, b := range clientKey {
		clientProof[i] ^= b
	}
	clientProof64 := make([]byte, base64.StdEncoding.EncodedLen(len(clientProof)))
	base64.StdEncoding.Encode(clientProof64, clientProof)
	return clientProof64
}

// EncryptBySalt Encrypt by salt
func EncryptBySalt(secret string, salt []byte, iteration, keylen int) ([]byte, error) {
	return pbkdf2.Key([]byte(secret), salt, iteration, keylen, sha256.New), nil
}

// Key needs to be 32bytes
